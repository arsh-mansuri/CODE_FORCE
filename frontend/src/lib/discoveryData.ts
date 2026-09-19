import type { DiscoveryCandidate } from '../types/discovery';

export const DISCOVERY_CANDIDATES: DiscoveryCandidate[] = [
  {
    id: 'ananya-desai',
    name: 'Ananya Desai',
    age: 25,
    verified: true,
    subtitle: 'Architect & Interior Stylist • CEPT Graduate',
    locationCity: 'Ahmedabad',
    locationArea: 'Navrangpura',
    matchScore: 94,
    chips: [
      { icon: 'wb_sunny', label: 'Early riser (6:30 AM)' },
      { icon: 'cleaning_services', label: 'Cleanliness: 9/10' },
      { icon: 'laptop_mac', label: 'WFH: 3 days/week' },
      { icon: 'payments', label: 'Budget: ₹14,000–₹18,000/mo', isBudget: true },
    ],
    photos: [
      {
        id: 'ananya-p1',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&auto=format&fit=crop&q=80',
        tag: 'Morning chai on balcony',
        aspectRatio: 'portrait',
      },
      {
        id: 'ananya-p2',
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&auto=format&fit=crop&q=80',
        tag: 'Living room drawing space',
        aspectRatio: 'landscape',
      },
    ],
    prompts: [
      {
        id: 'ananya-pr1',
        label: 'MY NON-NEGOTIABLE ROOMMATE RULE...',
        text: 'Kitchen counter wiped clean before sleeping, and peaceful quiet hours respected after 11 PM.',
      },
      {
        id: 'ananya-pr2',
        label: "ON SUNDAY MORNINGS YOU'LL FIND ME...",
        text: 'Brewing fresh ginger masala chai and browsing heritage textile prints at the kitchen table.',
      },
      {
        id: 'ananya-pr3',
        label: 'BUDGET & COST PHILOSOPHY...',
        text: 'Torrent Power bill & Wi-Fi split strictly 50/50 via UPI on the 1st of every month without reminders.',
      },
    ],
    bento: {
      desiredArea: {
        title: 'Navrangpura / Bodakdev',
        subtitle: 'Close to CEPT & Metro station',
      },
      moveInDate: {
        title: 'November 1st',
        subtitle: '11-month agreement',
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
