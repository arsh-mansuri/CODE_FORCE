from datetime import timedelta

from sqlalchemy import select

from app.models import Match, PropertyReview, ReviewPhoto, utcnow
from app.schemas import Intent
from conftest import photo_bytes


def connect(client, seeker, seeker_headers, provider, provider_headers):
    for target, headers in ((provider, seeker_headers), (seeker, provider_headers)):
        result = client.post('/api/swipe', headers=headers, json={'target_id': target['user']['id'], 'direction': 'like'})
        assert result.status_code == 200, result.text
    assert result.json()['matched']
    return result.json()['match_id']


def publish(client, listing_id, headers, **overrides):
    data = {'rating': '4', 'experience': 'visited', 'content': 'A bright living room and a helpful host during the visit.', **overrides}
    return client.post(f'/api/listings/{listing_id}/reviews', headers=headers, data=data,
        files=[('files', ('visit.jpg', photo_bytes(4), 'image/jpeg'))])


def test_reviews_require_mutual_match_and_remain_shared_property_history(client, register, app):
    seeker, sh, _ = register(Intent.seek_entire_home)
    provider, ph, _ = register(Intent.offer_entire_home)
    stranger, uh, _ = register(Intent.seek_entire_home)
    listing_id = provider['user']['offering']['id']
    endpoint = f'/api/listings/{listing_id}/reviews'
    assert client.get(endpoint).status_code == 401
    assert publish(client, listing_id, sh).status_code == 403
    assert publish(client, listing_id, ph).status_code == 403
    assert client.post('/api/swipe', headers=sh, json={'target_id': provider['user']['id'], 'direction': 'like'}).status_code == 200
    assert publish(client, listing_id, sh).status_code == 403
    match_id = connect(client, seeker, sh, provider, ph)
    assert client.get(endpoint, headers=sh).json()['can_review']
    response = publish(client, listing_id, sh)
    assert response.status_code == 201, response.text
    review = response.json()
    assert review['author_id'] == seeker['user']['id']
    assert review['experience'] == 'visited' and review['rating'] == 4
    assert len(review['photos']) == 1
    photo = review['photos'][0]
    assert client.get(photo['url']).headers['content-type'] == 'image/jpeg'
    assert client.get(photo['thumbnail_url']).status_code == 200
    assert publish(client, listing_id, sh).status_code == 409
    # An unmatched person can read published reviews before deciding to connect.
    feed = client.get(endpoint, headers=uh).json()
    assert feed['total'] == 1 and feed['average_rating'] == 4
    assert feed['items'][0]['content'] == review['content']
    assert not feed['items'][0]['is_mine'] and not feed['can_review']
    assert client.get(endpoint, headers=sh).json()['own_review_id'] == review['id']
    # Paused matches retain the complete history, rather than hiding old reviews.
    with app.state.session_factory() as db:
        db.get(Match, match_id).is_active = False
        db.commit()
    properties = client.get('/api/reviews/properties', headers=sh).json()
    assert properties[0]['listing']['id'] == listing_id and not properties[0]['active_match']
    assert properties[0]['review_count'] == 1
    assert client.get('/api/reviews/properties', headers=ph).json()[0]['is_owner']
    assert client.get('/api/reviews/properties', headers=uh).json() == []
    assert client.get(endpoint, headers=sh).json()['items'][0]['id'] == review['id']


def test_photo_batch_is_atomic_and_review_deletion_is_author_only(client, register, app):
    seeker, sh, _ = register(Intent.seek_entire_home)
    provider, ph, _ = register(Intent.offer_entire_home)
    connect(client, seeker, sh, provider, ph)
    listing_id = provider['user']['offering']['id']
    endpoint = f'/api/listings/{listing_id}/reviews'
    before = set(app.state.settings.media_root.iterdir())
    result = client.post(endpoint, headers=sh, data={'rating': 5, 'experience': 'visited', 'content': 'A genuinely useful visit to this property.'},
        files=[('files', ('valid.jpg', photo_bytes(4), 'image/jpeg')), ('files', ('invalid.jpg', b'not an image', 'image/jpeg'))])
    assert result.status_code == 415
    assert set(app.state.settings.media_root.iterdir()) == before
    assert client.get(endpoint, headers=sh).json()['total'] == 0
    assert publish(client, listing_id, sh, content=' ' * 12).status_code == 422
    assert publish(client, listing_id, sh, rating='6').status_code == 422
    assert publish(client, listing_id, sh, experience='made_up').status_code == 422
    review = publish(client, listing_id, sh).json()
    assert client.delete(f"/api/reviews/{review['id']}", headers=ph).status_code == 404
    assert client.delete(f"/api/reviews/{review['id']}", headers=sh).status_code == 200
    assert client.get(review['photos'][0]['url']).status_code == 404
    assert set(app.state.settings.media_root.iterdir()) == before
    assert client.get(endpoint, headers=sh).json()['can_review']


def test_recent_and_helpful_highlights_are_distinct_and_history_is_paginated(client, register, app):
    provider, ph, _ = register(Intent.offer_entire_home)
    listing_id = provider['user']['offering']['id']
    endpoint = f'/api/listings/{listing_id}/reviews'
    reviews = []
    for index in range(3):
        seeker, sh, _ = register(Intent.seek_entire_home)
        connect(client, seeker, sh, provider, ph)
        response = client.post(endpoint, headers=sh, data={
            'rating': index + 1, 'experience': 'connected', 'content': f'The provider explained the property clearly, experience {index}.',
        })
        assert response.status_code == 201, response.text
        review = response.json()
        reviews.append(review)
        with app.state.session_factory() as db:
            db.get(PropertyReview, review['id']).created_at = utcnow() - timedelta(days=3 - index)
            db.commit()
        assert client.put(f"/api/reviews/{review['id']}/helpful", headers=sh, json={'helpful': True}).status_code == 403
    _, reader, _ = register(Intent.seek_entire_home)
    helpful_url = f"/api/reviews/{reviews[0]['id']}/helpful"
    for _ in range(2):
        response = client.put(helpful_url, headers=reader, json={'helpful': True})
        assert response.status_code == 200 and response.json()['helpful_count'] == 1
    feed = client.get(endpoint, headers=reader, params={'limit': 1}).json()
    assert feed['total'] == 3 and feed['average_rating'] == 2
    assert feed['items'][0]['id'] == reviews[2]['id']
    assert [review['id'] for review in feed['highlights']] == [reviews[2]['id'], reviews[0]['id']]
    assert feed['has_more'] and feed['next_offset'] == 1
    second = client.get(endpoint, headers=reader, params={'limit': 1, 'offset': 1}).json()
    assert second['items'][0]['id'] == reviews[1]['id']
    best = client.get(endpoint, headers=reader, params={'sort': 'helpful', 'limit': 1}).json()
    assert best['items'][0]['id'] == reviews[0]['id'] and best['items'][0]['helpful_by_me']
    assert client.put(helpful_url, headers=reader, json={'helpful': False}).json()['helpful_count'] == 0


def test_property_isolation_and_photo_limits(client, register, app):
    seeker, sh, _ = register(Intent.seek_entire_home)
    provider, ph, _ = register(Intent.offer_entire_home)
    other, oh, _ = register(Intent.offer_entire_home)
    match_id = connect(client, seeker, sh, provider, ph)
    listing_id = provider['user']['offering']['id']
    assert publish(client, other['user']['offering']['id'], sh).status_code == 403
    before = set(app.state.settings.media_root.iterdir())
    result = client.post(f'/api/listings/{listing_id}/reviews', headers=sh,
        data={'rating': 4, 'experience': 'visited', 'content': 'A useful tour of this bright space.'},
        files=[('files', (f'{i}.jpg', photo_bytes(i), 'image/jpeg')) for i in range(7)])
    assert result.status_code == 422
    assert set(app.state.settings.media_root.iterdir()) == before
    with app.state.session_factory() as db:
        db.get(Match, match_id).is_active = False
        db.commit()
    assert publish(client, listing_id, sh).status_code == 403
    with app.state.session_factory() as db:
        assert db.scalar(select(PropertyReview)) is None
        assert db.scalar(select(ReviewPhoto)) is None


def test_removing_a_listing_removes_review_photos(client, register, app):
    seeker, sh, _ = register(Intent.seek_entire_home)
    provider, ph, body = register(Intent.offer_entire_home)
    connect(client, seeker, sh, provider, ph)
    review = publish(client, provider['user']['offering']['id'], sh).json()
    with app.state.session_factory() as db:
        photos = list(db.scalars(select(ReviewPhoto)))
        filenames = [filename for photo in photos for filename in (photo.filename, photo.thumbnail_filename)]
    _, _, seeker_body = register(Intent.seek_entire_home)
    result = client.put('/api/users/me', headers=ph, json={'profile': seeker_body['profile'], 'offering': None})
    assert result.status_code == 200, result.text
    assert client.get(review['photos'][0]['url']).status_code == 404
    assert all(not (app.state.settings.media_root / filename).exists() for filename in filenames)
