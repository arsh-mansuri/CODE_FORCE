from .schemas import (
    Diet, Gender, Intent, LandmarkKind, PropertyType, Question, QuestionOption,
    Questionnaire, QuestionSection,
)
from .config import Settings


ALL = list(Intent)
SEEK = [Intent.seek_entire_home, Intent.seek_room, Intent.seek_roommate]
SHARE = [Intent.seek_room, Intent.seek_roommate, Intent.offer_shared_home]
OFFER = [Intent.offer_entire_home, Intent.offer_shared_home]


def options(values):
    return [QuestionOption(value=v, label=v.replace("_", " ").capitalize()) for v in values]


def q(field, prompt, kind, help_text, *, required=False, applies_to=None, choices=(), used_for=()):
    return Question(
        field=field, prompt=prompt, input_type=kind, help_text=help_text, required=required,
        applies_to=ALL if applies_to is None else applies_to,
        options=options(choices), used_for=list(used_for),
    )


def questionnaire(settings: Settings) -> Questionnaire:
    sections = [
        QuestionSection(id="account", title="Let's get to know you", questions=[
            q("email", "Which email would you like to sign in with?", "email", "Private; never shown on discovery cards.", required=True),
            q("password", "Choose a password", "password", "Use 10–128 characters.", required=True),
            q("profile.full_name", "What name would you like people to see?", "text", "Your display name, up to 100 characters.", required=True),
            q("profile.age", "How old are you?", "number", "PropVibe is for adults aged 18 and above.", required=True),
            q("profile.gender", "How would you like to describe your gender?", "single_choice", "You can choose not to share. Specific roommate requirements only match explicitly supplied answers.", choices=[v.value for v in Gender]),
            q("profile.gender_description", "Would you like to describe that in your own words?", "text", "Optional, only when gender is self_described. Not used for algorithmic inference."),
            q("profile.occupation", "What keeps you busy most days?", "text", "Optional work or study description."),
            q("profile.bio", "What would you like a future housemate or provider to know?", "text", "Optional introduction, up to 1,000 characters."),
            q("profile.intent", "What would help you right now?", "single_choice", "Choose one primary goal. seek_room joins someone who already has a home; seek_roommate finds someone to search together.", required=True, choices=[v.value for v in Intent], used_for=["intent_routing"]),
        ]),
        QuestionSection(id="search", title="Your next home", questions=[
            q("profile.search.location.city", "Which city would work for you?", "text", "One city for this search.", required=True, applies_to=SEEK, used_for=["hard_filter"]),
            q("profile.search.location.areas", "Any neighbourhoods you would like to be in?", "list", "Optional. Areas and PIN codes are alternative acceptable localities, not a radius lookup.", applies_to=SEEK, used_for=["hard_filter"]),
            q("profile.search.location.pincodes", "Do you have preferred PIN codes?", "list", "Optional six-digit Indian PIN codes, e.g. 380009.", applies_to=SEEK, used_for=["hard_filter"]),
            q("profile.search.location.nearby", "Is there a place you would like to live near?", "list", "Optional: kind, optional name, max_distance_km, and importance (preferred/required). This describes convenience, not your beliefs. Distances on listings are provider-declared.", applies_to=SEEK, choices=[v.value for v in LandmarkKind], used_for=["landmark_proximity"]),
            q("profile.search.budget", "What monthly rent range feels comfortable?", "object", "Supply minimum and maximum INR. Whole-home searches use total tenancy rent; room/roommate searches use your individual share. Utilities and deposit are separate.", required=True, applies_to=SEEK, used_for=["hard_filter", "rent_affordability"]),
            q("profile.search.property_types", "Which home layouts would work?", "multi_choice", "Select at least one. For a room, this is the layout of the entire flat.", required=True, applies_to=SEEK, choices=[v.value for v in PropertyType], used_for=["hard_filter"]),
            q("profile.search.move_in_from", "What's your earliest move-in date?", "date", "YYYY-MM-DD.", required=True, applies_to=SEEK, used_for=["hard_filter"]),
            q("profile.search.move_in_by", "What's your latest comfortable move-in date?", "date", "Must be on or after your earliest date.", required=True, applies_to=SEEK, used_for=["hard_filter"]),
            q("profile.search.stay_months", "How many months do you expect to stay?", "number", "1–60 months; checked against minimum lease length.", required=True, applies_to=SEEK, used_for=["hard_filter"]),
        ]),
    ]
    lifestyle = [
        ("cleanliness", "How do you like shared spaces to be kept?", "scale", "1: relaxed about clutter; 5: prefer frequent tidying.", ()),
        ("social_energy", "How much together-time feels good at home?", "scale", "1: mostly private time; 5: frequent shared activities.", ()),
        ("guests", "How often do you tend to host visitors?", "scale", "1: rarely; 5: frequently.", ()),
        ("noise_tolerance", "What sound level feels comfortable at home?", "scale", "1: quiet; 5: lively is fine.", ()),
        ("sleep_schedule", "Which sleep routine is closest to yours?", "single_choice", "Choose flexible if your routine varies.", ("early_bird", "night_owl", "flexible")),
        ("work_style", "Where do you usually work or study?", "single_choice", "This helps people discuss shared space during the day.", ("office", "hybrid", "remote", "varies")),
        ("diet", "Which food routine best describes yours?", "single_choice", "No routine is better than another. You may prefer not to say.", tuple(v.value for v in Diet)),
        ("smokes", "Do you currently smoke?", "boolean", "A practical household-fit question, without judgement.", ()),
        ("has_pets", "Will any pets move in with you?", "boolean", "This helps check whether the household can accommodate them.", ()),
    ]
    sections.append(QuestionSection(id="lifestyle", title="How home feels for you", questions=[
        q(f"profile.lifestyle.{field}", prompt, kind, help_text, required=True, applies_to=SHARE, choices=choices, used_for=["weighted_cosine", "irving_rankings"])
        for field, prompt, kind, help_text, choices in lifestyle
    ]))
    sections.append(QuestionSection(id="preferences", title="What makes sharing comfortable?", questions=[
        q("profile.roommate_preferences.genders", "Who would you feel comfortable sharing a home with?", "multi_choice", "Leave empty if open to anyone. Applies only to shared living.", applies_to=SHARE, choices=[v.value for v in Gender], used_for=["mutual_dealbreaker"]),
        q("profile.roommate_preferences.smoking_ok", "Would sharing with someone who smokes work for you?", "boolean", "false requires a smoke-free household; omit or null for no preference.", applies_to=SHARE, used_for=["mutual_dealbreaker"]),
        q("profile.roommate_preferences.pets_ok", "Would living with pets work for you?", "boolean", "false excludes households bringing pets; omit or null for no preference.", applies_to=SHARE, used_for=["mutual_dealbreaker"]),
        q("profile.roommate_preferences.diets", "Do you need a particular shared-kitchen food routine?", "multi_choice", "Optional. Empty means any routine. This never implies anyone's religion.", applies_to=SHARE, choices=[v.value for v in Diet], used_for=["mutual_dealbreaker"]),
        q("profile.compatibility_weights", "Which parts of home life matter most to you?", "object", "Optional importance weights, 0–5, for each of the nine lifestyle answers. At least one must be above zero. Defaults are provided.", applies_to=SHARE, used_for=["weighted_cosine", "irving_rankings"]),
        q("profile.room_priorities", "What would you value most in your own room?", "object", "Optional 0–5 priorities: size, private_bathroom, balcony, natural_light, quiet. For Rent Harmony, each person later values every actual room in INR/month.", applies_to=SHARE, used_for=["rent_valuation_onboarding"]),
    ]))
    offering = [
        ("title", "How would you describe the space in one line?", "text", "3–160 characters.", True, ()),
        ("description", "What else should someone know about the home?", "text", "Optional details, up to 3,000 characters.", False, ()),
        ("kind", "Are you offering the whole home or space within it?", "single_choice", "Whole-home intent requires entire_home; shared-home intent requires private_room or shared_room.", True, ("entire_home", "private_room", "shared_room")),
        ("property_type", "What's the layout of the whole home?", "single_choice", "Choose the flat layout even if offering just one room.", True, tuple(v.value for v in PropertyType)),
        ("provider_relationship", "Do you own this home or currently rent it?", "single_choice", "This is self-reported; it is not an ownership verification badge.", True, ("owner", "tenant")),
        ("location", "Where is the home?", "object", "Provide city, area, and six-digit pincode. An exact street address is not needed for discovery.", True, ()),
        ("monthly_rent", "What monthly rent are you asking?", "number", "INR for the whole tenancy, or per incoming person for shared homes.", True, ()),
        ("deposit", "Is a refundable deposit requested?", "number", "INR; defaults to zero.", False, ()),
        ("available_from", "When can someone move in?", "date", "YYYY-MM-DD.", True, ()),
        ("minimum_stay_months", "What's the minimum stay?", "number", "1–60 months; defaults to 1.", False, ()),
        ("available_spaces", "How many people can move into the shared home?", "number", "1–20 incoming people; whole homes use 1 tenancy.", False, ()),
        ("furnishing", "How furnished is the space?", "single_choice", "Defaults to unfurnished.", False, ("unfurnished", "semi_furnished", "furnished")),
        ("amenities", "What does the home offer?", "list", "Optional short amenity labels such as balcony or private bathroom.", False, ()),
        ("nearby_landmarks", "Which useful places are nearby?", "list", "Optional kind, name, and distance_km for each landmark; displayed as provider-declared distances.", False, ()),
        ("is_active", "Is the space currently available for discovery?", "boolean", "Defaults to true. Set false to pause discovery and new connections.", False, ()),
    ]
    sections.append(QuestionSection(id="offering", title="The home or space you're offering", questions=[
        q(f"offering.{field}", prompt, kind, help_text, required=required, applies_to=OFFER, choices=choices, used_for=["listing_discovery"])
        for field, prompt, kind, help_text, required, choices in offering
    ]))
    sections.append(QuestionSection(id="media", title="Bring your profile and home to life", questions=[
        Question(
            field="media.profile.photos", prompt="Add 3–6 photos that help people get to know you.",
            help_text="Choose clear, distinct photos. The first is your cover and the rest form your swipe-card carousel. Upload after account creation using your bearer token.",
            input_type="photos", required=True, upload_endpoint="/api/media/profile/photos",
            minimum_files=3, maximum_files=6, accepted_types=["image/jpeg", "image/png", "image/webp"],
            max_file_bytes=settings.max_photo_bytes, used_for=["profile_carousel", "discovery_readiness"],
        ),
        Question(
            field="media.profile.video", prompt="Would you like to add a short introduction video?",
            help_text="Optional. Introduce yourself and what feels like home to you. This does not affect your compatibility score.",
            input_type="video", upload_endpoint="/api/media/profile/video", minimum_files=0, maximum_files=1,
            accepted_types=["video/mp4", "video/webm"], max_file_bytes=settings.max_video_bytes,
            max_duration_seconds=settings.max_video_seconds, used_for=["profile_carousel"],
        ),
        Question(
            field="media.property.photos", prompt="Show your home with 3–6 photos.",
            help_text="Include the available room, kitchen, bathroom, and shared spaces. Choose the best overview as the cover; people can browse the rest before swiping.",
            input_type="photos", required=True, applies_to=OFFER, upload_endpoint="/api/media/property/photos",
            minimum_files=3, maximum_files=6, accepted_types=["image/jpeg", "image/png", "image/webp"],
            max_file_bytes=settings.max_photo_bytes, used_for=["property_carousel", "discovery_readiness"],
        ),
        Question(
            field="media.property.video", prompt="Would you like to add a short home walkthrough?",
            help_text="Optional. Show how the rooms connect and what the space looks like in daily life.",
            input_type="video", applies_to=OFFER, upload_endpoint="/api/media/property/video", minimum_files=0, maximum_files=1,
            accepted_types=["video/mp4", "video/webm"], max_file_bytes=settings.max_video_bytes,
            max_duration_seconds=settings.max_video_seconds, used_for=["property_carousel"],
        ),
    ]))
    return Questionnaire(
        introduction="There is no right way to live. Tell us what works for you so we can find compatible homes and people. Optional answers can be skipped; explicit requirements are checked before ranking.",
        sections=sections,
    )
