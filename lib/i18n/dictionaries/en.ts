/**
 * Phase 26 mini — English dictionary.
 *
 * Mirrors the KEY shape of `th.ts` (the structural type) but the
 * VALUES can be any string — we use `Record<keyof Dictionary, ...>` so
 * TS doesn't constrain English values to Thai literals.
 */
import type { th } from './th'
import type { Widen } from '../t'

type Dictionary = Widen<typeof th>

export const en: Dictionary = {
  // TopNavBar / common nav
  nav: {
    home: 'Home',
    rooms: 'Rooms',
    bookings: 'My Bookings',
    about: 'About',
    login: 'Sign in',
    logout: 'Sign out',
    notification: 'Notifications',
    greeting: 'Hello',
  },

  // Footer
  footer: {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact Us',
    careers: 'Careers',
    copyright: '© 2024 Zenzero Hotel. All rights reserved.',
  },

  // Homepage
  home: {
    heroTitle: 'Stay Above the Rest',
    heroSubtitle: 'Experience premium hospitality in every detail',
    featuredRooms: 'Featured Rooms',
    searchPlaceholder: 'Search rooms',
  },

  // Rooms list
  roomsList: {
    title: 'All Rooms',
    resultsCount: 'Showing {count} rooms',
    noResults: 'No rooms found',
    filterHeading: 'Filters',
  },

  // Room detail
  roomDetail: {
    amenities: 'Amenities',
    reviews: 'Guest Reviews',
    maxGuests: 'Up to {count} guests',
    view: 'View',
    floor: 'Floor',
    size: 'sqm',
    perNight: '/ night',
    bookNow: 'Book now',
  },

  // Auth
  auth: {
    loginTitle: 'Sign in',
    loginSubtitle: 'Welcome back',
    registerTitle: 'Create a new account',
    registerSubtitle: 'Start your premium stay experience',
    fullName: 'Full name',
    email: 'Email',
    password: 'Password',
    phone: 'Phone',
    signIn: 'Sign in',
    signUp: 'Sign up',
    signInWithGoogle: 'Sign in with Google',
    signUpWithGoogle: 'Sign up with Google',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
  },

  // Profile
  profile: {
    title: 'My Profile',
    subtitle: 'Manage your personal information and account settings',
    memberSince: 'Member since',
  },

  // 404 / not-found
  notFound: {
    title: 'Page Not Found',
    description: 'Sorry, the page you are looking for does not exist',
    goHome: 'Back to home',
  },
}
