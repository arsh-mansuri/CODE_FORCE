"""Seed three photographed properties and Rishi's seeker account; optionally enable the team."""
import argparse
from copy import deepcopy
from datetime import date, timedelta
from sqlalchemy import select

from app.config import Settings
from app.database import Base, make_engine, session_factory
from app.demo_media import add_demo_gallery, property_photo_paths, sync_property_gallery
from app.examples import signup_example
from app.matching import compatibility
from app.media_storage import remove_files
from app.media_views import onboarding_status
from app.models import User
from app.routes import apply_onboarding
from app.schemas import Intent, SignupRequest, UserProfileInput
from app.security import hash_password
from seed_team import DEFAULT_PASSWORD, TEAM_ACCOUNTS, TEAM_DISCOVERY_INTENTS

LEGACY_PROPERTIES = [
    {
        "name": "Aarav Shah",
        "email": "aarav.shah@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Shivalik Edge High-Rise Flat",
            "description": "Sun-drenched 3BHK flat in a premier gated high-rise society in Bodakdev. 11ft ceilings, Italian marble flooring, expansive balcony overlooking lush green gardens, modular kitchen with piped gas, and Voltas inverter ACs in every bedroom.",
            "kind": "entire_home",
            "property_type": "3bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Bodakdev", "pincode": "380054"},
            "monthly_rent": 36000,
            "deposit": 72000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 3},
                "notes": "Torrent Power actual bill split equally 3 ways via UPI every month."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Master Bedroom", "Bedroom 2", "Bedroom 3", "Living Room"],
                "billing_method": "included_in_electricity",
                "notes": "Voltas 1.5-ton split inverter ACs installed in all rooms."
            },
            "available_from": (date.today() + timedelta(days=12)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "semi_furnished",
            "amenities": ["Modular Kitchen", "Piped Gas", "Balcony Garden", "Club House Gym", "Covered Parking", "24/7 Security"],
            "nearby_landmarks": [
                {"kind": "workplace", "name": "Judges Bungalow Road", "distance_km": 0.3},
                {"kind": "other", "name": "Rajpath Club", "distance_km": 0.8}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Devang Joshi",
        "email": "devang.joshi@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Gulmohar Greens Luxury Bungalow",
            "description": "Sprawling independent 4BHK bungalow with a private landscaped front lawn, traditional courtyard, servant quarters, and solar rooftop. Quiet residential enclave near Thaltej Shilaj Road.",
            "kind": "entire_home",
            "property_type": "4bhk_plus",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Thaltej", "pincode": "380059"},
            "monthly_rent": 58000,
            "deposit": 116000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 4},
                "notes": "Torrent Power meter + rooftop solar offset keeps summer bills economical."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["All 4 Bedrooms", "Living Hall", "Family Lounge"],
                "billing_method": "included_in_electricity",
                "notes": "Daikin 5-star inverter mini-splits throughout the bungalow."
            },
            "available_from": (date.today() + timedelta(days=14)).isoformat(),
            "minimum_stay_months": 12,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["Private Garden Lawn", "Rooftop Solar", "Covered 2-Car Garage", "Borewell + Narmada Water", "Terrace Gazebo"],
            "nearby_landmarks": [
                {"kind": "other", "name": "Gulmohar Greens Golf Club", "distance_km": 1.2},
                {"kind": "public_transport", "name": "Thaltej Metro Station", "distance_km": 1.5}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Meera Patel",
        "email": "meera.patel@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Iscon Platinum Modern Flat",
            "description": "Chic 2BHK flat directly off Satellite Road near ISKCON temple. Fully modular Hafele kitchen, private utility balcony, high-speed fiber internet, and covered basement parking.",
            "kind": "entire_home",
            "property_type": "2bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Satellite", "pincode": "380015"},
            "monthly_rent": 24000,
            "deposit": 48000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 2},
                "notes": "Torrent Power bill split 50/50."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Master Bedroom", "Living Hall"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=7)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["Hafele Modular Kitchen", "High-speed Fiber WiFi", "Basement Parking", "Swimming Pool", "Gated Security"],
            "nearby_landmarks": [
                {"kind": "other", "name": "ISKCON Temple", "distance_km": 0.4},
                {"kind": "workplace", "name": "SG Highway Commercial Hub", "distance_km": 0.7}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Rohan Parekh",
        "email": "rohan.parekh@example.com",
        "intent": Intent.offer_shared_home,
        "offering": {
            "title": "Stanza Living Elite PG for Students & Pros",
            "description": "Premium serviced PG accommodation near CEPT, Gujarat University, and LD Engineering. Includes 3 wholesome home-style vegetarian meals, high-speed WiFi, biometric entry, daily housekeeping, and air-conditioned study rooms.",
            "kind": "private_room",
            "property_type": "1rk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Navrangpura", "pincode": "380009"},
            "monthly_rent": 13500,
            "deposit": 13500,
            "electricity": {
                "billing_method": "included_in_rent",
                "notes": "Electricity up to 120 units/room included. Sub-metered above quota."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Every Bedroom", "Co-working Study Lounge"],
                "billing_method": "included_in_rent"
            },
            "available_from": (date.today() + timedelta(days=3)).isoformat(),
            "minimum_stay_months": 3,
            "available_spaces": 2,
            "furnishing": "furnished",
            "amenities": ["3 Vegetarian Meals Daily", "Daily Housekeeping", "Laundry Facility", "High-Speed WiFi", "Biometric Security", "Study Lounge"],
            "nearby_landmarks": [
                {"kind": "university", "name": "CEPT University & GU", "distance_km": 0.4},
                {"kind": "public_transport", "name": "Commerce Six Roads Metro", "distance_km": 0.6}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Kabir Mehta",
        "email": "kabir.mehta@example.com",
        "intent": Intent.offer_shared_home,
        "offering": {
            "title": "Zolo Tribe Youth Co-Living Hostel",
            "description": "Vibrant youth co-living hostel for tech professionals and students along SG Highway. Shared gaming lounge with PlayStation, community screening amphitheatre, high-speed coworking desks, and gym access.",
            "kind": "shared_room",
            "property_type": "1bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "SG Highway", "pincode": "380054"},
            "monthly_rent": 8500,
            "deposit": 8500,
            "electricity": {
                "billing_method": "included_in_rent",
                "notes": "All utilities, WiFi, and power backup included in rent."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Bunk Dorms", "Coworking Space", "Recreation Lounge"],
                "billing_method": "included_in_rent"
            },
            "available_from": (date.today() + timedelta(days=1)).isoformat(),
            "minimum_stay_months": 1,
            "available_spaces": 4,
            "furnishing": "furnished",
            "amenities": ["Gaming Zone & PS5", "Coworking Desks", "Commercial Gym", "Community Dinners", "24/7 Power Backup", "Biometric Lockers"],
            "nearby_landmarks": [
                {"kind": "workplace", "name": "SG Highway IT Park", "distance_km": 0.5},
                {"kind": "other", "name": "Gota Flyover / SG Mall", "distance_km": 1.1}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Ananya Desai",
        "email": "ananya.desai@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Vastrapur Lakeview Apartment Flat",
            "description": "Breezy 3BHK flat on the 9th floor directly overlooking Vastrapur Lake. Walk to AlphaOne Mall, Ahmedabad One, and IIM New Campus. Dual balconies, vitrified tiles, and wooden paneling.",
            "kind": "entire_home",
            "property_type": "3bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Vastrapur", "pincode": "380015"},
            "monthly_rent": 32000,
            "deposit": 64000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 3},
                "notes": "Torrent Power bill split equally 3 ways."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Living Room", "Master Bedroom", "Lake-facing Room"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=10)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "semi_furnished",
            "amenities": ["Lakefront Balcony", "AlphaOne Mall Walking Distance", "Covered Parking", "Piped Gas", "Children Play Area"],
            "nearby_landmarks": [
                {"kind": "other", "name": "Vastrapur Lake Garden", "distance_km": 0.1},
                {"kind": "university", "name": "IIM Ahmedabad (New Campus)", "distance_km": 0.8}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Siddharth Dave",
        "email": "siddharth.dave@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Suramya Abode Courtyard Villa Bungalow",
            "description": "Serene 4BHK gated villa bungalow with an open central courtyard (aangan), landscaped backyard with sit-out, and private rooftop deck. Close to Science City and SP Ring Road.",
            "kind": "entire_home",
            "property_type": "4bhk_plus",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Science City", "pincode": "380060"},
            "monthly_rent": 46000,
            "deposit": 92000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 4},
                "notes": "UGVCL power grid billing divided equally among co-tenants."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["All 4 Bedrooms", "Main Courtyard Hall"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=20)).isoformat(),
            "minimum_stay_months": 12,
            "available_spaces": 1,
            "furnishing": "semi_furnished",
            "amenities": ["Internal Aangan Courtyard", "Private Backyard Garden", "Rooftop Gazebo", "Double Height Ceilings", "Solar Water Heating"],
            "nearby_landmarks": [
                {"kind": "other", "name": "Gujarat Science City", "distance_km": 0.6},
                {"kind": "workplace", "name": "SP Ring Road Junction", "distance_km": 1.0}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Harshil Vora",
        "email": "harshil.vora@example.com",
        "intent": Intent.offer_shared_home,
        "offering": {
            "title": "Oxford Comforts Girls PG",
            "description": "Safe, warm, and highly rated women's PG in prime Ambawadi. Dedicated female warden, CCTV security, pure vegetarian kitchen, attached bathrooms with geysers, and quiet study spaces.",
            "kind": "shared_room",
            "property_type": "1rk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Ambawadi", "pincode": "380006"},
            "monthly_rent": 11000,
            "deposit": 11000,
            "electricity": {
                "billing_method": "included_in_rent",
                "notes": "Rent covers electricity, hot water, and WiFi."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["All Twin-sharing Rooms"],
                "billing_method": "included_in_rent"
            },
            "available_from": (date.today() + timedelta(days=4)).isoformat(),
            "minimum_stay_months": 6,
            "available_spaces": 2,
            "furnishing": "furnished",
            "amenities": ["Female Warden & 24/7 Guard", "Pure Veg Meals", "Attached Bath with Geyser", "RO Drinking Water", "Daily Cleaning"],
            "nearby_landmarks": [
                {"kind": "university", "name": "Ahmedabad University (AU)", "distance_km": 0.9},
                {"kind": "other", "name": "Parimal Garden", "distance_km": 0.5}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Priya Trivedi",
        "email": "priya.trivedi@example.com",
        "intent": Intent.offer_shared_home,
        "offering": {
            "title": "The Nest Student Hostel & Co-Living",
            "description": "Contemporary student and young professional hostel minutes from PDPU, DA-IICT, and GNLU in Gandhinagar / Bhaijipura. High-speed optical fiber, cafeteria, library, laundry room, and sports turf.",
            "kind": "shared_room",
            "property_type": "1bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Gandhinagar", "pincode": "382007"},
            "monthly_rent": 9500,
            "deposit": 9500,
            "electricity": {
                "billing_method": "included_in_rent",
                "notes": "Power, solar water heating, and high-speed WiFi included in monthly hostel charges."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Dormitory Rooms", "Reading Hall"],
                "billing_method": "included_in_rent"
            },
            "available_from": (date.today() + timedelta(days=2)).isoformat(),
            "minimum_stay_months": 6,
            "available_spaces": 3,
            "furnishing": "furnished",
            "amenities": ["Hostel Cafeteria", "Sports Box Turf", "Library & Study Desks", "Free Laundry Machines", "CCTV Surveillance"],
            "nearby_landmarks": [
                {"kind": "university", "name": "PDPU & DA-IICT Campus", "distance_km": 1.1},
                {"kind": "other", "name": "Koba Circle Bus Depot", "distance_km": 1.4}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Aditya Solanki",
        "email": "aditya.solanki@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Prarthna Heights Sunlit Flat",
            "description": "Bright and airy 2BHK flat in the heart of Prahlad Nagar. Walking distance to Corporate Road corporate hubs, Starbucks, and Prahladnagar Garden. Fully equipped with piped gas, water purifier, and high-speed broadband.",
            "kind": "entire_home",
            "property_type": "2bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Prahlad Nagar", "pincode": "380015"},
            "monthly_rent": 28000,
            "deposit": 56000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 2},
                "notes": "Torrent Power monthly bill split equally via GPay/PhonePe."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Master Bedroom", "Second Bedroom"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=15)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["Piped Gas Connection", "RO Water Purifier", "Covered Stilt Parking", "Elevator with Backup", "Jogging Track"],
            "nearby_landmarks": [
                {"kind": "other", "name": "Prahladnagar Garden", "distance_km": 0.2},
                {"kind": "workplace", "name": "Corporate Road Tech Parks", "distance_km": 0.5}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Tanvi Bhatt",
        "email": "tanvi.bhatt@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Royal Heritage Row House Bungalow",
            "description": "Classic 3BHK duplex row house bungalow with private porch parking, enclosed terrace, and backyard wash area in quiet, tree-lined Satellite neighborhood. Very close to Shivranjani Crossroads.",
            "kind": "entire_home",
            "property_type": "3bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Satellite", "pincode": "380015"},
            "monthly_rent": 38000,
            "deposit": 76000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 3},
                "notes": "Torrent Power residential connection, paid monthly."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Ground Floor Bedroom", "2 Upper Floor Bedrooms"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=16)).isoformat(),
            "minimum_stay_months": 12,
            "available_spaces": 1,
            "furnishing": "semi_furnished",
            "amenities": ["Private Front Porch", "Duplex Layout", "Independent Terrace", "Borewell + AMC Water", "Quiet Residential Lane"],
            "nearby_landmarks": [
                {"kind": "public_transport", "name": "Shivranjani BRTS & Metro", "distance_km": 0.5},
                {"kind": "other", "name": "Star Bazaar Satellite", "distance_km": 0.9}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Diya Choksi",
        "email": "diya.choksi@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Goyal Orchid Executive Flat",
            "description": "Modern 2BHK flat in high-demand residential society near Makarba and Corporate Road. Excellent cross-ventilation, wooden flooring in master bed, and modern washrooms with glass shower enclosures.",
            "kind": "entire_home",
            "property_type": "2bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Prahlad Nagar", "pincode": "380051"},
            "monthly_rent": 22000,
            "deposit": 44000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 2},
                "notes": "Torrent Power bill split equally 2 ways."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Master Bedroom", "Living Hall"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=8)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "semi_furnished",
            "amenities": ["Glass Shower Cubicles", "Covered Car Parking", "Elevators with Inverter", "Clubhouse Gym", "Children Play Area"],
            "nearby_landmarks": [
                {"kind": "workplace", "name": "Makarba Business Hub", "distance_km": 0.4},
                {"kind": "public_transport", "name": "SG Highway BRTS Route", "distance_km": 0.8}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Neha Panchal",
        "email": "neha.panchal@example.com",
        "intent": Intent.offer_shared_home,
        "offering": {
            "title": "Shreeji Boys Executive PG",
            "description": "High-standard PG for male professionals and university scholars in Panjrapole / University area. Air-conditioned double and single sharing rooms, daily meal plan, study desks, and weekly linen service.",
            "kind": "private_room",
            "property_type": "1rk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Navrangpura", "pincode": "380015"},
            "monthly_rent": 10500,
            "deposit": 10500,
            "electricity": {
                "billing_method": "included_in_rent",
                "notes": "Standard usage included in rent; sub-meter installed for heavy appliance usage."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["All Executive Rooms"],
                "billing_method": "included_in_rent"
            },
            "available_from": (date.today() + timedelta(days=5)).isoformat(),
            "minimum_stay_months": 3,
            "available_spaces": 2,
            "furnishing": "furnished",
            "amenities": ["Daily Lunch & Dinner", "Personal Study Desk", "High-speed WiFi", "Weekly Room Cleaning", "Hot Water Geyser"],
            "nearby_landmarks": [
                {"kind": "university", "name": "IIM Ahmedabad Main Gate", "distance_km": 0.7},
                {"kind": "other", "name": "Panjrapole Crossroads", "distance_km": 0.3}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Pooja Modi",
        "email": "pooja.modi@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Heritage Haveli Restored Pol Flat",
            "description": "Artistically restored 2BHK flat in the historic UNESCO World Heritage Pols near Sabarmati Riverfront. Hand-carved teakwood brackets, traditional courtyard breezes, modern concealed plumbing, and high-speed fiber.",
            "kind": "entire_home",
            "property_type": "2bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Navrangpura", "pincode": "380001"},
            "monthly_rent": 18000,
            "deposit": 36000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 2},
                "notes": "Torrent Power heritage zone tariff."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Both Bedrooms"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=9)).isoformat(),
            "minimum_stay_months": 11,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["UNESCO Pol Architecture", "Hand-carved Wood Ceilings", "Sabarmati Riverfront Access", "Fiber Internet", "Antique Furniture"],
            "nearby_landmarks": [
                {"kind": "other", "name": "Sabarmati Riverfront Promenade", "distance_km": 0.3},
                {"kind": "other", "name": "Manek Chowk Heritage Square", "distance_km": 0.6}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Chirag Soni",
        "email": "chirag.soni@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Venus Pasadena Luxury Flat",
            "description": "Ultra-spacious 3BHK flat in one of Bodakdev's most prestigious gated communities. Features 3 en-suite bathrooms, servant room, wrap-around sunset balcony, central water softener, and smart video door security.",
            "kind": "entire_home",
            "property_type": "3bhk",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Bodakdev", "pincode": "380054"},
            "monthly_rent": 42000,
            "deposit": 84000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 3},
                "notes": "Torrent Power bill split equally 3 ways."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Living & Dining Salon", "All 3 En-Suite Bedrooms"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=18)).isoformat(),
            "minimum_stay_months": 12,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["Video Door Security", "Wrap-around Balcony", "Water Softener Plant", "Gym & Tennis Court", "2 Dedicated Basement Parking Slots"],
            "nearby_landmarks": [
                {"kind": "workplace", "name": "Sindhu Bhavan Road (SBR)", "distance_km": 0.5},
                {"kind": "other", "name": "Pakwan Crossroads", "distance_km": 0.8}
            ],
            "is_active": True,
        }
    },
    {
        "name": "Rakesh Patel",
        "email": "rakesh.patel@example.com",
        "intent": Intent.offer_entire_home,
        "offering": {
            "title": "Himalaya Studio Flat",
            "description": "Cozy and bright independent studio flat with private balcony, kitchenette, and high-speed broadband. Ideal for young professionals or scholars working near Ghatlodia / Memnagar.",
            "kind": "entire_home",
            "property_type": "studio",
            "provider_relationship": "owner",
            "location": {"city": "Ahmedabad", "area": "Navrangpura", "pincode": "380061"},
            "monthly_rent": 15000,
            "deposit": 30000,
            "electricity": {
                "billing_method": "actual_bill",
                "split": {"method": "equal", "split_between": 2},
                "notes": "Torrent Power independent sub-meter."
            },
            "air_conditioning": {
                "available": True,
                "locations": ["Studio Living Area"],
                "billing_method": "included_in_electricity"
            },
            "available_from": (date.today() + timedelta(days=7)).isoformat(),
            "minimum_stay_months": 6,
            "available_spaces": 1,
            "furnishing": "furnished",
            "amenities": ["Private Balcony", "Equipped Kitchenette", "Elevator", "Power Backup", "Two-Wheeler Parking"],
            "nearby_landmarks": [
                {"kind": "public_transport", "name": "Ghatlodia Cross Roads", "distance_km": 0.3},
                {"kind": "other", "name": "Memnagar Lake Park", "distance_km": 0.9}
            ],
            "is_active": True,
        }
    },
]


# One whole flat, one private room and one shared room, each with its own photo set.
MOCK_PROPERTIES = [
    {**LEGACY_PROPERTIES[0], "image_set": "p1"},
    {**LEGACY_PROPERTIES[3], "image_set": "p2"},
    {**LEGACY_PROPERTIES[4], "image_set": "p3"},
]
RISHI_EMAIL = "rc.rishi.pc@gmail.com"


def ensure_rishi(db, settings, created_files, retired_files):
    user = db.scalar(select(User).where(User.email == RISHI_EMAIL))
    data = signup_example(Intent.seek_roommate, "Rishi")
    data.update(email=RISHI_EMAIL, password=DEFAULT_PASSWORD)
    if user is None:
        user = User(email=RISHI_EMAIL, password_hash=hash_password(DEFAULT_PASSWORD))
        apply_onboarding(user, SignupRequest.model_validate(data))
        db.add(user)
    profile = user.profile.data
    user.profile.data = UserProfileInput.model_validate({
        **profile,
        "intent": profile["intent"] if profile["intent"] in [i.value for i in TEAM_DISCOVERY_INTENTS] else Intent.seek_room.value,
        "intents": [i.value for i in TEAM_DISCOVERY_INTENTS],
        "search": profile.get("search") or data["profile"]["search"],
        "lifestyle": profile.get("lifestyle") or data["profile"]["lifestyle"],
    }).model_dump(mode="json")
    if user.listing is not None:
        retired_files.extend(user.listing.media_assets)
        user.listing = None
    db.flush()
    add_demo_gallery(db, user, "profile", settings, 1, created_files)
    return user


def seed_more(settings: Settings | None = None, *, for_team: bool = False):
    settings = settings or Settings.from_env()
    # Fail before touching the database if any required source photo is missing.
    for prop in MOCK_PROPERTIES:
        property_photo_paths(prop["image_set"])
    settings.media_root.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.database_url)
    created_files = []
    retired_files = []
    summary = []
    try:
        Base.metadata.create_all(engine)
        with session_factory(engine)() as db:
            try:
                team = []
                if for_team:
                    for email, _ in TEAM_ACCOUNTS:
                        user = db.scalar(select(User).where(User.email == email))
                        if user is None or user.profile is None or not user.profile.data.get("search"):
                            raise RuntimeError(f"Team seeker {email} is missing. Create the team accounts with seed_team.py first.")
                        profile = UserProfileInput.model_validate(user.profile.data)
                        goals = list(dict.fromkeys([*profile.selected_intents, *TEAM_DISCOVERY_INTENTS]))
                        # Assign a new JSON object so SQLAlchemy persists the change.
                        user.profile.data = UserProfileInput.model_validate({
                            **profile.model_dump(mode="json"), "intents": goals,
                        }).model_dump(mode="json")
                        team.append(user)

                rishi = ensure_rishi(db, settings, created_files, retired_files)
                if rishi not in team:
                    team.append(rishi)

                # Retire only known old seed offerings, preserving their activity.
                selected_emails = {prop["email"] for prop in MOCK_PROPERTIES}
                retired_emails = ({prop["email"] for prop in LEGACY_PROPERTIES} - selected_emails) | {"demo6@example.com", "demo8@example.com"}
                for user in db.scalars(select(User).where(User.email.in_(retired_emails))):
                    if user.listing is not None:
                        user.listing.is_active = False
                        user.listing.data = {**user.listing.data, "is_active": False}

                providers = []
                for idx, prop in enumerate(MOCK_PROPERTIES, start=9):
                    data = signup_example(prop["intent"], prop["name"], idx)
                    data["email"] = prop["email"]
                    data["profile"].update(
                        age=28 + (idx % 12), occupation="Demo Property Host & Resident",
                        bio=f"Demo property host in {prop['offering']['location']['area']}, Ahmedabad.",
                        intents=[prop["intent"].value],
                    )
                    # Shared-home hosts have explicit demo lifestyle answers so
                    # the normal ranking algorithm can produce 85%+ matches.
                    data["offering"] = deepcopy(prop["offering"])
                    body = SignupRequest.model_validate(data)
                    user = db.scalar(select(User).where(User.email == str(body.email)))
                    if user is None:
                        user = User(email=str(body.email), password_hash=hash_password(body.password.get_secret_value()))
                        db.add(user)
                    apply_onboarding(user, body)
                    db.flush()
                    for target in ("profile", "property"):
                        sync_property_gallery(db, user, target, settings, prop["image_set"], created_files, retired_files)
                    db.flush()
                    db.expire(user, ["media_assets"])
                    db.expire(user.listing, ["media_assets"])
                    if not onboarding_status(user).complete:
                        raise RuntimeError(f"Incomplete demo provider galleries: {user.email}")
                    providers.append(user)

                for user in team:
                    scores = [score for provider in providers if (score := compatibility(user, provider)) is not None]
                    top = sum(score.score >= 85 for score in scores)
                    if not scores or not top:
                        raise RuntimeError(f"Demo catalog has no 85%+ results for {user.email}; check their saved search preferences.")
                    summary.append((user.email, len(scores), top))
                db.commit()
            except Exception:
                db.rollback()
                remove_files(settings.media_root, created_files)
                raise
        remove_files(settings.media_root, retired_files)
    finally:
        engine.dispose()
    print(f"Seeded {len(MOCK_PROPERTIES)} Ahmedabad demo properties using p1, p2 and p3 in both provider and property galleries.")
    print(f"Seeker: {RISHI_EMAIL} (new accounts use the team demo password).")
    for email, count, top in summary:
        print(f"{email}: {count} catalog properties, {top} top matches (85%+).")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--for-team", action="store_true", help="Add room and whole-home search goals to the four existing team accounts, preserving IDs, sessions, photos and activity.")
    seed_more(for_team=parser.parse_args().for_team)
