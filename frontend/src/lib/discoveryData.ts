import type { DiscoveryCandidate } from '../types/discovery';

export const DISCOVERY_CANDIDATES: DiscoveryCandidate[] = [
  {
    id: 'elena-vance',
    name: 'Elena Vance',
    age: 26,
    verified: true,
    subtitle: 'Product Designer • Studio in DUMBO',
    locationCity: 'Brooklyn, NY',
    locationArea: 'Bushwick',
    matchScore: 94,
    chips: [
      { icon: 'wb_sunny', label: 'Early riser (6:30 AM)' },
      { icon: 'cleaning_services', label: 'Cleanliness: 9/10' },
      { icon: 'laptop_mac', label: 'WFH: 3 days/week' },
      { icon: 'payments', label: 'Budget: $1,400–$1,650/mo', isBudget: true },
    ],
    photos: [
      {
        id: 'elena-p1',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA88ZFpHuvw728DLqGF96ASeveWOssBEeLA2UKWTsAZoDnB_SHTQXyk0QlqOjK0ptQsg53JEfTDb8U05gNJDECjNA69Dbb7SZyUBNlepKIpypUH-iBy4ESbcE5oa3GtEM9Iau2jtOY4uXaID88Xfmj2TrEo9VJUqF3eD5K9hysBpNXHiGTLJGQ1hynEm4SccvQnEZnz2guKkYboyW-hjTHa85SSoBTAEDa1cnJJjbEl3SnER32nBpQGhA',
        tag: 'Sunlight on Jefferson St',
        aspectRatio: 'portrait',
      },
      {
        id: 'elena-p2',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKBSZzFBbnfQvo0-FRRPsoI4Jw3nbU3M7fJ1awWRd925sxOr2zdjoWmm3tccK1J3cUAqfyzWCDGmJAcUnJs6FtlFvaeXo9AfjaiGCSa2r58STRpwwxOgWtteGEAYM6lIAtBY82xugj-13lIhTN7untxoVTKlc8LLSmTz3hj2BMFid5ndQrNxULBRsskT7reIEl0oft4UGxmF9qFfw9WBTunhMoNxL873zKoBXgtGWTdnJh58gclj8TVQ',
        tag: 'Common room vibes',
        aspectRatio: 'landscape',
      },
    ],
    prompts: [
      {
        id: 'elena-pr1',
        label: 'MY NON-NEGOTIABLE ROOMMATE RULE...',
        text: 'Dishes done before bed and communal coffee beans are sacred.',
      },
      {
        id: 'elena-pr2',
        label: "ON SUNDAY MORNINGS YOU'LL FIND ME...",
        text: 'Brewing pour-over and reading architectural magazines at the kitchen table.',
      },
      {
        id: 'elena-pr3',
        label: 'BUDGET & COST PHILOSOPHY...',
        text: 'Split utilities 50/50, strictly transparent, zero passive-aggressive sticky notes.',
      },
    ],
    bento: {
      desiredArea: {
        title: 'Bushwick / Ridgewood',
        subtitle: 'L / M Trains (5 min walk)',
      },
      moveInDate: {
        title: 'October 1st',
        subtitle: '12-month lease',
      },
    },
  },
  {
    id: 'meera-patel',
    name: 'Meera Patel',
    age: 24,
    verified: true,
    subtitle: 'Brand Strategist • Tech Co',
    locationCity: 'Ahmedabad',
    locationArea: 'Navrangpura',
    matchScore: 91,
    chips: [
      { icon: 'bedtime', label: 'Night owl (Midnight tea)' },
      { icon: 'cleaning_services', label: 'Cleanliness: 8/10' },
      { icon: 'laptop_mac', label: 'WFH: Remote' },
      { icon: 'payments', label: 'Budget: ₹12,000–₹16,000/mo', isBudget: true },
    ],
    photos: [
      {
        id: 'meera-p1',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop&q=80',
        tag: 'Balcony morning chai',
        aspectRatio: 'portrait',
      },
      {
        id: 'meera-p2',
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&auto=format&fit=crop&q=80',
        tag: 'Art & study corner',
        aspectRatio: 'landscape',
      },
    ],
    prompts: [
      {
        id: 'meera-pr1',
        label: 'A SHARING STANDARD I CARE ABOUT...',
        text: 'Quiet hours after 11 PM on weekdays, but open to weekend cooking experiments together.',
      },
      {
        id: 'meera-pr2',
        label: 'HOW I HANDLE HOUSE CHORES...',
        text: 'Shared chore checklist on the fridge, with deep cleaning rotated every alternate Sunday.',
      },
    ],
    bento: {
      desiredArea: {
        title: 'Navrangpura / Vastrapur',
        subtitle: 'Near Metro & Bus routes',
      },
      moveInDate: {
        title: 'November 1st',
        subtitle: '11-month agreement',
      },
    },
  },
  {
    id: 'aarav-shah',
    name: 'Aarav Shah',
    age: 25,
    verified: true,
    subtitle: 'Frontend Engineer • Open Source',
    locationCity: 'Ahmedabad',
    locationArea: 'Bodakdev',
    matchScore: 89,
    chips: [
      { icon: 'wb_sunny', label: 'Early bird (7:00 AM)' },
      { icon: 'cleaning_services', label: 'Cleanliness: 9/10' },
      { icon: 'laptop_mac', label: 'WFH: Hybrid' },
      { icon: 'payments', label: 'Budget: ₹10,000–₹15,000/mo', isBudget: true },
    ],
    photos: [
      {
        id: 'aarav-p1',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&auto=format&fit=crop&q=80',
        tag: 'Focus workspace',
        aspectRatio: 'portrait',
      },
      {
        id: 'aarav-p2',
        url: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=900&auto=format&fit=crop&q=80',
        tag: 'Kitchen & meal prep',
        aspectRatio: 'landscape',
      },
    ],
    prompts: [
      {
        id: 'aarav-pr1',
        label: 'IDEAL LIVING ROOM VIBE...',
        text: 'Acoustic background music, plenty of sunlight, and mutual respect for personal space.',
      },
    ],
    bento: {
      desiredArea: {
        title: 'Bodakdev / SG Highway',
        subtitle: 'Quick commute to IT parks',
      },
      moveInDate: {
        title: 'Immediate / Next Week',
        subtitle: 'Flexible lease term',
      },
    },
  },
];
