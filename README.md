# CODE_FORCE

## Backend MVP

The FastAPI backend provides complete intent-based signup, SQLite persistence,
housing/roommate discovery, profile/property photo and video uploads, scored
Tinder-style card responses, mutual swipes and chat, Irving stable matching, and
explainable approximate Rent Harmony calculations.

See **[backend setup and demo guide](backend/README.md)** and the
**[API integration guide](backend/API.md)**.

```bash
cd backend
uv venv --python 3.12
uv pip install -r requirements.txt
uv run --no-project python seed_db.py
uv run --no-project uvicorn main:app --reload --port 8000
```

Interactive documentation: **http://localhost:8000/docs**. Core features run
without external API keys. Seeded credentials are documented in the backend guide.

## Tinder for PropTech

We're building **Tinder for PropTech** — a swipe-based matching platform to help people discover living spaces and compatible housemates. Our goal is to make finding a place and the people to share it with simpler, more transparent, and more accessible, especially for first-time renters and young adults.

## Track 4: PropTech — Next-Gen Real Estate & Living Space Management

Finding, leasing, and living in shared residential or commercial spaces involves substantial friction, especially for first-time renters and young adults navigating rental markets independently. Common pain points include opaque contractual agreements, difficulty finding compatible housemates, delayed property maintenance, and poor transparency in property valuations and living costs.

This track encourages solutions that bring transparency, fairness, and modern digital workflows to real estate and communal living through accessible web platforms or mobile apps. Ideas can span tools that simplify legal agreements, platforms that improve co-living experiences and roommate matching, or interactive systems that streamline communication and maintenance between tenants, property managers, and service providers.
