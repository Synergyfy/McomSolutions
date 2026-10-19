export const CUSTOMER_PREVIEW = {
  firstName: 'David',
  lastName: 'Eluwole',
  email: 'davideluwole@gmail.com',
  jobTitle: 'Full-Stack Web Engineer & Customer',
  country: 'Nigeria',
  region: 'Lagos State',
  phone: '+234 812 000 8901',
  currency: 'USD ($) - US Dollar',
  memberSince: 'July 2025',
  tier: 'Gold Tier Status',
  referralCode: 'C7D82C33',
  activeReferrals: 14,
  pointsEarned: 7000,
  idVerificationValidUntil: '2028',
  lastPasswordUpdate: '2 weeks ago',
  twoFactorEnabled: true,
  walletBalance: 1250,
  pendingRewards: 45.5,
  loyaltyPoints: 12450,
  unreadMessages: 3,
};

export interface CustomerPreviewNotification {
  id: string;
  title: string;
  description: string;
  category: string;
  time: string;
  unread: boolean;
  icon: string;
  tone: 'orange' | 'blue' | 'sky' | 'rose' | 'slate';
  action: string;
  destination: 'wallet' | 'ecosystem' | 'messages' | 'settings';
}

export const CUSTOMER_NOTIFICATIONS: CustomerPreviewNotification[] = [
  { id: 'tier-gold', title: 'Gold Tier Multiplier Activated!', description: 'You have officially unlocked Gold Tier status on MCOM Premium Club. Your 10% bonus points multiplier is now automatically active for all connected merchant purchases across the ecosystem.', category: 'Tier & Loyalty', time: '10 minutes ago', unread: true, icon: 'award', tone: 'orange', action: 'View Tier Benefits', destination: 'ecosystem' },
  { id: 'wallet-topup', title: 'Wallet Top-up Successful (+$250.00)', description: 'Your deposit of $250.00 via Paystack card payment was processed successfully and credited to your primary wallet. New balance: $1,250.00.', category: 'Wallet & Payments', time: '2 hours ago', unread: true, icon: 'wallet', tone: 'blue', action: 'View Transaction Receipt', destination: 'wallet' },
  { id: 'daily-spins', title: '2 Free Daily Spins Available on MCOM Play!', description: 'Your daily spin reset is ready. Spin the wheel now to unlock wallet cashback, tier bonus multipliers, or partner retail discount vouchers.', category: 'MCOM Ecosystem', time: '5 hours ago', unread: true, icon: 'game', tone: 'sky', action: 'Launch Arcade', destination: 'ecosystem' },
  { id: 'local-perk', title: 'New Local Perk Nearby: Metro Coffee Trail', description: "A verified local partner within 15km of your location just added a ‘Buy 1 Get 1 Free’ stamp campaign for active MCOM members.", category: 'Local Perks', time: 'Yesterday at 4:15 PM', unread: true, icon: 'perk', tone: 'rose', action: 'Claim Voucher', destination: 'ecosystem' },
  { id: 'support-reply', title: 'New Message from CHS Concierge Desk', description: 'Support officer Sarah K. replied to your ticket regarding enterprise webhook notifications and Paystack deposit escalation.', category: 'Messages & Chat', time: 'Oct 17, 2026', unread: false, icon: 'support', tone: 'slate', action: 'Open Chat Thread', destination: 'messages' },
];

export const OLDER_CUSTOMER_NOTIFICATIONS: CustomerPreviewNotification[] = [
  { id: 'password-change', title: 'Password updated successfully', description: 'Your customer account password was updated. If you did not make this change, contact CHS support.', category: 'Security & System', time: 'Oct 14, 2026', unread: false, icon: 'security', tone: 'blue', action: 'Review account security', destination: 'settings' },
  { id: 'cashback-credit', title: 'Cashback reward credited', description: 'A recent MCOM partner purchase earned a cashback reward. Review your wallet activity for details.', category: 'Wallet & Payments', time: 'Oct 12, 2026', unread: false, icon: 'wallet', tone: 'blue', action: 'View Wallet', destination: 'wallet' },
  { id: 'new-partner', title: 'New rewards partner joined MCOM', description: 'There are new offers to explore from businesses in the connected MCOM ecosystem.', category: 'MCOM Ecosystem', time: 'Oct 10, 2026', unread: false, icon: 'game', tone: 'sky', action: 'Explore MCOM', destination: 'ecosystem' },
];

export const CUSTOMER_PRODUCTS = [
  { id: 'loyalty-wallet', name: 'Digital Loyalty Wallet', description: 'Store digital passes, track status progression, and auto-sync loyalty points across connected merchant networks.', category: 'Loyalty & Rewards', state: 'Connected', detail: 'Active & synced', icon: 'wallet', tone: 'orange', action: 'Launch app' },
  { id: 'cashback', name: 'Cashback & Stamp Engine', description: 'Earn automatic cashback on everyday merchant spends and collect digital verification stamps.', category: 'Loyalty & Rewards', state: 'Connected', detail: 'Tier 3 VIP multiplier', icon: 'piggy', tone: 'orange', action: 'Manage rewards' },
  { id: 'play-win', name: 'MCOM Play & Win', description: 'Spin the daily rewards wheel, play quick games, and win wallet credits or merchant vouchers.', category: 'Gamification & Play', state: 'Available', detail: '2 free daily spins', icon: 'game', tone: 'blue', action: 'Play now' },
  { id: 'local-perks', name: 'Local Business Perks', description: 'Discover curated neighbourhood discounts, contactless redemption, and local community benefits.', category: 'Local Perks', state: 'Connected', detail: '42 partners nearby', icon: 'pin', tone: 'blue', action: 'Browse local deals' },
  { id: 'gift-market', name: 'Gift Card & Voucher Marketplace', description: 'Purchase, send, and redeem digital gift vouchers from regional and global brands.', category: 'Utilities & Gift Cards', state: 'Available', detail: 'Instant wallet delivery', icon: 'gift', tone: 'orange', action: 'Explore marketplace' },
  { id: 'premium-club', name: 'MCOM Premium Club', description: 'Unlock higher membership tiers, priority support, and increased rewards across the network.', category: 'Loyalty & Rewards', state: 'Upgrade available', detail: 'Current tier: Gold', icon: 'award', tone: 'blue', action: 'Upgrade status' },
];

export const CUSTOMER_TRANSACTIONS = [
  { id: 'TXN-90821', date: 'Oct 19, 2026 · 14:22', source: 'Wallet Top-up', description: 'Card funding via Paystack', method: 'Card via Paystack', amount: 250, type: 'credit', status: 'Success' },
  { id: 'TXN-89419', date: 'Oct 18, 2026 · 09:15', source: 'MCOM Cashback', description: 'Reward redemption · Retail partner', method: 'Rewards engine', amount: 15, type: 'credit', status: 'Completed' },
  { id: 'TXN-88102', date: 'Oct 16, 2026 · 18:40', source: 'Voucher Redemption', description: 'Digital gift voucher', method: 'MCOM Marketplace', amount: 50, type: 'debit', status: 'Processed' },
  { id: 'TXN-87005', date: 'Oct 12, 2026 · 11:05', source: 'Loyalty Points Conversion', description: 'Points converted to voucher', method: 'MCOM Points Sync', amount: 500, type: 'points', status: 'Processed' },
  { id: 'TXN-85991', date: 'Oct 08, 2026 · 16:30', source: 'Pending Merchant Reward', description: 'Retail partner purchase', method: 'Merchant network', amount: 30.5, type: 'credit', status: 'Pending' },
  { id: 'TXN-84802', date: 'Oct 04, 2026 · 13:08', source: 'Local Perk', description: 'Coffee shop offer redeemed', method: 'Local Business Perks', amount: 8, type: 'debit', status: 'Completed' },
];

export interface CustomerPreviewMessage {
  id: string;
  from: 'them' | 'me';
  text: string;
  time: string;
  perk?: string;
}

export interface CustomerPreviewConversation {
  id: string;
  name: string;
  label: string;
  kind: 'Support' | 'Merchants';
  avatar: string;
  unread: number;
  time: string;
  preview: string;
  tag: string;
  messages: CustomerPreviewMessage[];
}

export const CUSTOMER_CONVERSATIONS: CustomerPreviewConversation[] = [
  { id: 'concierge', name: 'CHS Concierge Desk', label: 'Official', kind: 'Support', avatar: 'headset', unread: 0, time: '10:42 AM', preview: 'Your Gold Tier bonus points have been successfully synced to your wallet ledger…', tag: 'Gold Tier Support', messages: [
    { id: 'm1', from: 'them', text: 'Hello David! We noticed you recently upgraded to Gold Tier status on MCOM Premium Club. Your 10% bonus points multiplier is now active across all connected merchant purchases.', time: '10:38 AM' },
    { id: 'm2', from: 'me', text: 'Awesome, thanks for confirming! Will this bonus also apply to my recent Paystack wallet top-up and local perk redemptions?', time: '10:40 AM' },
    { id: 'm3', from: 'them', text: 'Yes, absolutely! The 10% bonus automatically applies to all wallet funding credits and partner voucher conversions. Let us know if you need help with anything else!', time: '10:42 AM', perk: 'Active Perk: 10% Gold Points Multiplier (+50 bonus points credited on your last $250 Paystack deposit)' },
  ] },
  { id: 'metro-arena', name: 'Metro Arena Rewards', label: '', kind: 'Merchants', avatar: 'MA', unread: 1, time: 'Yesterday', preview: 'Exclusive quest tickets are now available for the…', tag: 'Promotions & Events', messages: [{ id: 'a1', from: 'them', text: 'Exclusive quest tickets are now available for the Metro Arena weekend events. Open your rewards app to see what is included.', time: 'Yesterday' }] },
  { id: 'bite-repeat', name: 'Bite & Repeat Pizza Partner', label: '', kind: 'Merchants', avatar: 'BC', unread: 1, time: 'Oct 17', preview: 'Thank you for redeeming your 15% cashback…', tag: 'Merchant Rebate', messages: [{ id: 'b1', from: 'them', text: 'Thank you for redeeming your 15% cashback offer. Your reward has been added to your wallet.', time: 'Oct 17' }] },
  { id: 'security', name: 'CHS Security & Billing', label: '', kind: 'Support', avatar: 'shield', unread: 0, time: 'Oct 15', preview: 'Wallet top-up confirmation receipt #TXN-90821.', tag: 'System Automated', messages: [{ id: 's1', from: 'them', text: 'Your wallet top-up is complete. Receipt reference: TXN-90821.', time: 'Oct 15' }] },
  { id: 'city-market', name: 'City Market Offers', label: '', kind: 'Merchants', avatar: 'CM', unread: 0, time: 'Oct 12', preview: 'New neighbourhood offers are available this week.', tag: 'Local Offers', messages: [{ id: 'c1', from: 'them', text: 'New neighbourhood offers are available this week. Browse the MCOM ecosystem to find one nearby.', time: 'Oct 12' }] },
];
