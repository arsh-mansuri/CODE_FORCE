import pytest

from app.schemas import Intent


@pytest.mark.parametrize("owner_already_liked", [False, True])
def test_tour_request_reaches_listing_owner_and_becomes_match_chat(client, register, owner_already_liked):
    seeker, seeker_headers, _ = register(Intent.seek_entire_home)
    provider, provider_headers, _ = register(Intent.offer_entire_home)
    listing = client.get("/api/listings", headers=seeker_headers).json()["items"][0]["listing"]
    assert listing["owner_id"] == provider["user"]["id"]
    assert listing["id"] != listing["owner_id"]

    if owner_already_liked:
        assert client.post("/api/swipe", headers=provider_headers, json={
            "target_id": seeker["user"]["id"], "direction": "like",
        }).status_code == 200

    note = f'Hi! I\'d like to arrange a tour of "{listing["title"]}". When would be a good time?'
    payload = {"target_id": listing["owner_id"], "direction": "like", "note": note}
    response = client.post("/api/swipe", headers=seeker_headers, json=payload)
    assert response.status_code == 200
    assert response.json()["matched"] is owner_already_liked
    # A retry must reuse the same request/match rather than duplicate it.
    assert client.post("/api/swipe", headers=seeker_headers, json=payload).json() == response.json()

    if not owner_already_liked:
        inbox = client.get("/api/connections/requests", headers=provider_headers).json()
        assert inbox["total"] == 1
        assert inbox["items"][0]["requester"]["id"] == seeker["user"]["id"]
        assert inbox["items"][0]["note"] == note
        assert inbox["items"][0]["direction"] == "like"
        assert client.get("/api/matches", headers=seeker_headers).json() == []
        response = client.post("/api/swipe", headers=provider_headers, json={
            "target_id": seeker["user"]["id"], "direction": "like",
        })

    assert response.json()["matched"] is True
    match_id = response.json()["match_id"]
    for headers in (seeker_headers, provider_headers):
        matches = client.get("/api/matches", headers=headers).json()
        assert len(matches) == 1 and matches[0]["id"] == match_id
        messages = client.get(f"/api/matches/{match_id}/messages", headers=headers).json()
        assert [message["content"] for message in messages] == [note]
        assert messages[0]["sender_id"] == seeker["user"]["id"]
    assert client.get("/api/connections/requests", headers=provider_headers).json()["total"] == 0
