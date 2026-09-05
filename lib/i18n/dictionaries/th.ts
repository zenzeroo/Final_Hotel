/**
 * Phase 26 mini — Thai (default) dictionary.
 *
 * Keys are namespaced: `<namespace>.<key>`. Add new strings here when
 * localizing new UI surfaces. The `en.ts` mirror must keep the same
 * shape so `t()` can typecheck.
 */
export const th = {
  // TopNavBar / common nav
  nav: {
    home: 'หน้าแรก',
    rooms: 'ห้องพัก',
    bookings: 'ประวัติการจอง',
    about: 'เกี่ยวกับโรงแรม',
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    notification: 'การแจ้งเตือน',
    greeting: 'สวัสดี',
  },

  // Footer
  footer: {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact Us',
    careers: 'Careers',
    copyright: '© 2024 Zenzero Hotel. สงวนลิขสิทธิ์',
  },

  // Homepage
  home: {
    heroTitle: 'พักผ่อนที่เหนือระดับ',
    heroSubtitle: 'สัมผัสประสบการณ์การบริการระดับพรีเมียม',
    featuredRooms: 'ห้องพักแนะนำ',
    searchPlaceholder: 'ค้นหาห้องพัก',
  },

  // Rooms list
  roomsList: {
    title: 'ห้องพักทั้งหมด',
    resultsCount: 'แสดง {count} ห้อง',
    noResults: 'ไม่พบห้องพัก',
    filterHeading: 'ตัวกรอง',
  },

  // Room detail
  roomDetail: {
    amenities: 'สิ่งอำนวยความสะดวก',
    reviews: 'รีวิวจากผู้เข้าพัก',
    maxGuests: 'สูงสุด {count} ท่าน',
    view: 'วิว',
    floor: 'ชั้น',
    size: 'ตร.ม.',
    perNight: '/ คืน',
    bookNow: 'จองเลย',
  },

  // Auth
  auth: {
    loginTitle: 'เข้าสู่ระบบ',
    loginSubtitle: 'ยินดีต้อนรับกลับมา',
    registerTitle: 'สร้างบัญชีใหม่',
    registerSubtitle: 'เริ่มต้นประสบการณ์พักผ่อนที่เหนือระดับ',
    fullName: 'ชื่อ-นามสกุล',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    phone: 'เบอร์โทรศัพท์',
    signIn: 'เข้าสู่ระบบ',
    signUp: 'สมัครสมาชิก',
    signInWithGoogle: 'เข้าสู่ระบบด้วย Google',
    signUpWithGoogle: 'สมัครสมาชิกด้วย Google',
    noAccount: 'ยังไม่มีบัญชี?',
    haveAccount: 'มีบัญชีอยู่แล้ว?',
  },

  // Profile
  profile: {
    title: 'โปรไฟล์ของฉัน',
    subtitle: 'จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชีของคุณ',
    memberSince: 'สมาชิกตั้งแต่',
  },

  // 404 / not-found
  notFound: {
    title: 'ไม่พบหน้าที่คุณต้องการ',
    description: 'ขออภัย หน้าที่คุณกำลังมองหาไม่อยู่ในระบบ',
    goHome: 'กลับหน้าหลัก',
  },
} as const

export type Dictionary = typeof th
