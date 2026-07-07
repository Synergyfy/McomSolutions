export interface Sector {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  sectorId: string;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export const SECTORS: Sector[] = [
  { id: 'hospitality-food', name: 'Hospitality, Food & Beverage' },
  { id: 'retail-wholesale', name: 'Retail & Wholesale' },
  { id: 'manufacturing-industrial', name: 'Manufacturing & Industrial' },
  { id: 'professional-business', name: 'Professional & Business Services' },
  { id: 'construction-property', name: 'Construction, Property & Trades' },
  { id: 'health-wellness', name: 'Health, Wellness & Personal Care' },
  { id: 'education-training', name: 'Education, Training & Childcare' },
  { id: 'transport-logistics', name: 'Transport, Logistics & Automotive' },
  { id: 'technology-digital', name: 'Technology, Digital & Creative' },
  { id: 'financial-insurance', name: 'Financial, Insurance & Real Estate' },
  { id: 'tourism-travel', name: 'Tourism, Travel & Leisure' },
  { id: 'agriculture-environment', name: 'Agriculture, Environment & Energy' },
  { id: 'community-public', name: 'Community, Non-Profit & Public Services' },
  { id: 'online-micro', name: 'Home-Based, Online & Micro-Businesses' },
];

export const CATEGORIES: Category[] = [
  // Hospitality, Food & Beverage
  { id: 'dining', name: 'Restaurants & Dining', sectorId: 'hospitality-food' },
  { id: 'cafes', name: 'Cafés & Beverage Outlets', sectorId: 'hospitality-food' },
  { id: 'catering', name: 'Catering & Events', sectorId: 'hospitality-food' },
  { id: 'nightlife', name: 'Pubs, Bars & Nightlife', sectorId: 'hospitality-food' },
  { id: 'food-production', name: 'Food Production & Distribution', sectorId: 'hospitality-food' },
  // Retail & Wholesale
  { id: 'grocery', name: 'Grocery & Convenience', sectorId: 'retail-wholesale' },
  { id: 'fashion', name: 'Fashion & Accessories', sectorId: 'retail-wholesale' },
  { id: 'electronics', name: 'Electronics & Appliances', sectorId: 'retail-wholesale' },
  { id: 'home-lifestyle', name: 'Home & Lifestyle', sectorId: 'retail-wholesale' },
  { id: 'wholesale-dist', name: 'Wholesale & Distribution', sectorId: 'retail-wholesale' },
  // Manufacturing & Industrial
  { id: 'light-mfg', name: 'Light Manufacturing', sectorId: 'manufacturing-industrial' },
  { id: 'heavy-mfg', name: 'Heavy Manufacturing', sectorId: 'manufacturing-industrial' },
  { id: 'fb-mfg', name: 'Food & Beverage Manufacturing', sectorId: 'manufacturing-industrial' },
  { id: 'chem-materials', name: 'Chemical & Materials', sectorId: 'manufacturing-industrial' },
  { id: 'engineering-fab', name: 'Engineering & Fabrication', sectorId: 'manufacturing-industrial' },
  // Professional & Business Services
  { id: 'consulting', name: 'Consulting & Advisory', sectorId: 'professional-business' },
  { id: 'legal-compliance', name: 'Legal & Compliance', sectorId: 'professional-business' },
  // Construction, Property & Trades
  { id: 'construction', name: 'Construction', sectorId: 'construction-property' },
  { id: 'property', name: 'Property Services', sectorId: 'construction-property' },
  { id: 'trades', name: 'Trade & Handyman Services', sectorId: 'construction-property' },
  // Health, Wellness & Personal Care
  { id: 'medical', name: 'Medical & Clinical', sectorId: 'health-wellness' },
  { id: 'beauty', name: 'Beauty & Grooming', sectorId: 'health-wellness' },
  // Education, Training & Childcare
  { id: 'schools', name: 'Schools & Colleges', sectorId: 'education-training' },
  { id: 'childcare', name: 'Childcare Services', sectorId: 'education-training' },
  // Transport, Logistics & Automotive
  { id: 'freight', name: 'Freight & Logistics', sectorId: 'transport-logistics' },
  { id: 'automotive', name: 'Automotive Services', sectorId: 'transport-logistics' },
  // Technology, Digital & Creative
  { id: 'software-it', name: 'Software & IT', sectorId: 'technology-digital' },
  { id: 'media-content', name: 'Media & Content', sectorId: 'technology-digital' },
  // Financial, Insurance & Real Estate
  { id: 'fin-svcs', name: 'Financial Services', sectorId: 'financial-insurance' },
  { id: 'real-estate-dev', name: 'Real Estate Development', sectorId: 'financial-insurance' },
  // Tourism, Travel & Leisure
  { id: 'accommodation', name: 'Accommodation', sectorId: 'tourism-travel' },
  { id: 'leisure-ent', name: 'Leisure & Entertainment', sectorId: 'tourism-travel' },
  // Agriculture, Environment & Energy
  { id: 'farming', name: 'Farming & Food Production', sectorId: 'agriculture-environment' },
  { id: 'energy', name: 'Renewable Energy', sectorId: 'agriculture-environment' },
  // Community, Non-Profit & Public Services
  { id: 'charity-ngo', name: 'Charities & NGOs', sectorId: 'community-public' },
  { id: 'public-svcs', name: 'Public & Social Services', sectorId: 'community-public' },
  // Home-Based, Online & Micro-Businesses
  { id: 'ecommerce', name: 'E-Commerce', sectorId: 'online-micro' },
  { id: 'digital-ent', name: 'Digital Entrepreneurs', sectorId: 'online-micro' },
];

export const SUBCATEGORIES: Subcategory[] = [
  // Hospitality - Restaurants & Dining
  { id: 'fine-dining', name: 'Fine Dining Restaurants', categoryId: 'dining' },
  { id: 'casual-dining', name: 'Casual Dining Restaurants', categoryId: 'dining' },
  { id: 'fast-food', name: 'Fast Food / QSR', categoryId: 'dining' },
  { id: 'takeaway', name: 'Takeaway Shops', categoryId: 'dining' },
  { id: 'street-food', name: 'Street Food Vendors', categoryId: 'dining' },
  { id: 'ghost-kitchen', name: 'Ghost Kitchens', categoryId: 'dining' },
  { id: 'specialty-dining', name: 'Ethnic / Specialty Restaurants', categoryId: 'dining' },
  // Hospitality - Cafés & Beverage Outlets
  { id: 'coffee-shop', name: 'Coffee Shops', categoryId: 'cafes' },
  { id: 'tea-house', name: 'Tea Houses', categoryId: 'cafes' },
  { id: 'juice-bar', name: 'Juice Bars', categoryId: 'cafes' },
  { id: 'bubble-tea', name: 'Bubble Tea Shops', categoryId: 'cafes' },
  { id: 'dessert-cafe', name: 'Dessert Cafés', categoryId: 'cafes' },
  // Hospitality - Catering & Events
  { id: 'corp-catering', name: 'Corporate Catering', categoryId: 'catering' },
  { id: 'wedding-catering', name: 'Wedding Catering', categoryId: 'catering' },
  { id: 'mobile-catering', name: 'Mobile Catering Vans', categoryId: 'catering' },
  { id: 'event-food', name: 'Event Food Services', categoryId: 'catering' },
  { id: 'institutional-catering', name: 'School / Hospital Catering', categoryId: 'catering' },
  // Hospitality - Pubs, Bars & Nightlife
  { id: 'trad-pub', name: 'Traditional Pubs', categoryId: 'nightlife' },
  { id: 'cocktail-bar', name: 'Cocktail Bars', categoryId: 'nightlife' },
  { id: 'sports-bar', name: 'Sports Bars', categoryId: 'nightlife' },
  { id: 'wine-bar', name: 'Wine Bars', categoryId: 'nightlife' },
  { id: 'nightclub', name: 'Nightclubs', categoryId: 'nightlife' },
  { id: 'music-venue', name: 'Live Music Venues', categoryId: 'nightlife' },
  // Hospitality - Food Production & Distribution
  { id: 'bakery', name: 'Bakeries', categoryId: 'food-production' },
  { id: 'food-mfg', name: 'Food Manufacturers', categoryId: 'food-production' },
  { id: 'meal-prep', name: 'Meal Prep Companies', categoryId: 'food-production' },
  { id: 'food-wholesalers', name: 'Food Wholesalers', categoryId: 'food-production' },
  { id: 'food-importers', name: 'Food Importers', categoryId: 'food-production' },
  // Retail - Grocery & Convenience
  { id: 'supermarket', name: 'Supermarkets', categoryId: 'grocery' },
  { id: 'convenience', name: 'Convenience Stores', categoryId: 'grocery' },
  { id: 'off-licence', name: 'Off-Licences', categoryId: 'grocery' },
  { id: 'mini-mart', name: 'Mini-Marts', categoryId: 'grocery' },
  // Retail - Fashion & Accessories
  { id: 'clothing-store', name: 'Clothing Stores', categoryId: 'fashion' },
  { id: 'shoe-shop', name: 'Shoe Shops', categoryId: 'fashion' },
  { id: 'jewellery', name: 'Jewellery Shops', categoryId: 'fashion' },
  { id: 'bags-luggage', name: 'Bag & Luggage Stores', categoryId: 'fashion' },
  { id: 'tailor', name: 'Tailor Shops', categoryId: 'fashion' },
  // Retail - Electronics & Appliances
  { id: 'mobile-shop', name: 'Mobile Phone Shops', categoryId: 'electronics' },
  { id: 'computer-store', name: 'Computer Stores', categoryId: 'electronics' },
  { id: 'appliance-retail', name: 'Appliance Retailers', categoryId: 'electronics' },
  { id: 'gaming-store', name: 'Gaming Stores', categoryId: 'electronics' },
  // Retail - Home & Lifestyle
  { id: 'furniture-store', name: 'Furniture Stores', categoryId: 'home-lifestyle' },
  { id: 'home-decor', name: 'Home Décor Shops', categoryId: 'home-lifestyle' },
  { id: 'lighting-store', name: 'Lighting Stores', categoryId: 'home-lifestyle' },
  { id: 'kitchenware', name: 'Kitchenware Stores', categoryId: 'home-lifestyle' },
  // Retail - Wholesale & Distribution
  { id: 'cash-carry', name: 'Cash & Carry', categoryId: 'wholesale-dist' },
  { id: 'trade-wholesalers', name: 'Trade Wholesalers', categoryId: 'wholesale-dist' },
  { id: 'import-export', name: 'Import / Export Traders', categoryId: 'wholesale-dist' },
  { id: 'dist-centres', name: 'Distribution Centres', categoryId: 'wholesale-dist' },
  // Manufacturing - Light Manufacturing
  { id: 'clothing-mfg', name: 'Clothing Manufacturing', categoryId: 'light-mfg' },
  { id: 'furniture-mfg', name: 'Furniture Manufacturing', categoryId: 'light-mfg' },
  { id: 'packaging-prod', name: 'Packaging Production', categoryId: 'light-mfg' },
  { id: 'printing-press', name: 'Printing Presses', categoryId: 'light-mfg' },
  // Manufacturing - Heavy Manufacturing
  { id: 'metal-fab', name: 'Metal Fabrication', categoryId: 'heavy-mfg' },
  { id: 'machinery-mfg', name: 'Machinery Manufacturing', categoryId: 'heavy-mfg' },
  { id: 'auto-parts', name: 'Automotive Parts', categoryId: 'heavy-mfg' },
  { id: 'construction-mat', name: 'Construction Materials', categoryId: 'heavy-mfg' },
  // Manufacturing - Food & Beverage Manufacturing
  { id: 'bev-bottling', name: 'Beverage Bottling', categoryId: 'fb-mfg' },
  { id: 'meat-processing', name: 'Meat Processing', categoryId: 'fb-mfg' },
  { id: 'dairy-processing', name: 'Dairy Processing', categoryId: 'fb-mfg' },
  { id: 'confectionery-prod', name: 'Confectionery Production', categoryId: 'fb-mfg' },
  // Manufacturing - Chemical & Materials
  { id: 'paint-mfg', name: 'Paint Manufacturing', categoryId: 'chem-materials' },
  { id: 'plastic-proc', name: 'Plastic Processing', categoryId: 'chem-materials' },
  { id: 'cleaning-prod', name: 'Cleaning Products', categoryId: 'chem-materials' },
  { id: 'ind-chem', name: 'Industrial Chemicals', categoryId: 'chem-materials' },
  // Manufacturing - Engineering & Fabrication
  { id: 'cnc-workshop', name: 'CNC Workshops', categoryId: 'engineering-fab' },
  { id: 'welding-svcs', name: 'Welding Services', categoryId: 'engineering-fab' },
  { id: 'tool-making', name: 'Tool Making', categoryId: 'engineering-fab' },
  { id: 'prototyping-lab', name: 'Prototyping Labs', categoryId: 'engineering-fab' },
  // Professional - Consulting & Advisory
  { id: 'management-cons', name: 'Management Consulting', categoryId: 'consulting' },
  { id: 'financial-cons', name: 'Financial Consulting', categoryId: 'consulting' },
  { id: 'hr-cons', name: 'HR Consulting', categoryId: 'consulting' },
  { id: 'strategy-adv', name: 'Strategy Advisory', categoryId: 'consulting' },
  // Professional - Legal & Compliance
  { id: 'law-firms', name: 'Law Firms', categoryId: 'legal-compliance' },
  { id: 'imm-advisors', name: 'Immigration Advisors', categoryId: 'legal-compliance' },
  { id: 'compliance-cons', name: 'Compliance Consultants', categoryId: 'legal-compliance' },
  { id: 'notary-svcs', name: 'Notary Services', categoryId: 'legal-compliance' },
  // Construction - Construction
  { id: 'res-builders', name: 'Residential Builders', categoryId: 'construction' },
  { id: 'comm-contractors', name: 'Commercial Contractors', categoryId: 'construction' },
  { id: 'renovation-cos', name: 'Renovation Companies', categoryId: 'construction' },
  { id: 'civil-eng', name: 'Civil Engineering Firms', categoryId: 'construction' },
  // Construction - Property Services
  { id: 'estate-agents', name: 'Estate Agents', categoryId: 'property' },
  { id: 'letting-agents', name: 'Letting Agents', categoryId: 'property' },
  { id: 'prop-managers', name: 'Property Managers', categoryId: 'property' },
  { id: 'surveyors', name: 'Surveyors', categoryId: 'property' },
  // Construction - Trade & Handyman Services
  { id: 'electricians', name: 'Electricians', categoryId: 'trades' },
  { id: 'plumbers', name: 'Plumbers', categoryId: 'trades' },
  { id: 'carpenters', name: 'Carpenters', categoryId: 'trades' },
  { id: 'painters', name: 'Painters & Decorators', categoryId: 'trades' },
  // Health - Medical & Clinical
  { id: 'gp-clinics', name: 'GP Clinics', categoryId: 'medical' },
  { id: 'dental-practices', name: 'Dental Practices', categoryId: 'medical' },
  { id: 'physio-clinics', name: 'Physiotherapy Clinics', categoryId: 'medical' },
  { id: 'private-hospitals', name: 'Private Hospitals', categoryId: 'medical' },
  // Health - Beauty & Grooming
  { id: 'hair-salon', name: 'Hair Salons', categoryId: 'beauty' },
  { id: 'barbershop', name: 'Barbershops', categoryId: 'beauty' },
  { id: 'nail-salon', name: 'Nail Salons', categoryId: 'beauty' },
  { id: 'beauty-clinic', name: 'Beauty Clinics', categoryId: 'beauty' },
  // Education - Schools & Colleges
  { id: 'private-schools', name: 'Private Schools', categoryId: 'schools' },
  { id: 'tutorial-colleges', name: 'Tutorial Colleges', categoryId: 'schools' },
  { id: 'sixth-form', name: 'Sixth Form Colleges', categoryId: 'schools' },
  // Education - Childcare Services
  { id: 'nurseries', name: 'Nurseries', categoryId: 'childcare' },
  { id: 'daycare', name: 'Daycare Centres', categoryId: 'childcare' },
  { id: 'after-school', name: 'After-School Clubs', categoryId: 'childcare' },
  // Transport - Freight & Logistics
  { id: 'courier-svcs', name: 'Courier Services', categoryId: 'freight' },
  { id: 'haulage-cos', name: 'Haulage Companies', categoryId: 'freight' },
  { id: 'warehousing', name: 'Warehousing Providers', categoryId: 'freight' },
  { id: 'fulfilment', name: 'Fulfilment Centres', categoryId: 'freight' },
  // Transport - Automotive Services
  { id: 'car-garage', name: 'Car Garages', categoryId: 'automotive' },
  { id: 'mot-centre', name: 'MOT Centres', categoryId: 'automotive' },
  { id: 'tyre-shop', name: 'Tyre Shops', categoryId: 'automotive' },
  { id: 'auto-body', name: 'Auto Body Repair', categoryId: 'automotive' },
  // Technology - Software & IT
  { id: 'sw-devs', name: 'Software Developers', categoryId: 'software-it' },
  { id: 'saas-prov', name: 'SaaS Providers', categoryId: 'software-it' },
  { id: 'it-support', name: 'IT Support Firms', categoryId: 'software-it' },
  // Technology - Media & Content
  { id: 'video-prod', name: 'Video Production', categoryId: 'media-content' },
  { id: 'photo-studio', name: 'Photography Studios', categoryId: 'media-content' },
  { id: 'podcast-net', name: 'Podcast Networks', categoryId: 'media-content' },
  // Financial - Financial Services
  { id: 'fin-advisors', name: 'Financial Advisors', categoryId: 'fin-svcs' },
  { id: 'mortgage-brk', name: 'Mortgage Brokers', categoryId: 'fin-svcs' },
  { id: 'invest-firms', name: 'Investment Firms', categoryId: 'fin-svcs' },
  // Financial - Real Estate Development
  { id: 'prop-devs', name: 'Property Developers', categoryId: 'real-estate-dev' },
  { id: 'comm-invest', name: 'Commercial Investors', categoryId: 'real-estate-dev' },
  { id: 'housing-assoc', name: 'Housing Associations', categoryId: 'real-estate-dev' },
  // Tourism - Accommodation
  { id: 'hotels', name: 'Hotels', categoryId: 'accommodation' },
  { id: 'guest-houses', name: 'Guest Houses', categoryId: 'accommodation' },
  { id: 'serviced-apts', name: 'Serviced Apartments', categoryId: 'accommodation' },
  { id: 'hostels', name: 'Hostels', categoryId: 'accommodation' },
  { id: 'bnb', name: 'B&Bs', categoryId: 'accommodation' },
  // Tourism - Leisure & Entertainment
  { id: 'theme-parks', name: 'Theme Parks', categoryId: 'leisure-ent' },
  { id: 'cinemas', name: 'Cinemas', categoryId: 'leisure-ent' },
  { id: 'escape-rooms', name: 'Escape Rooms', categoryId: 'leisure-ent' },
  { id: 'casinos', name: 'Casinos', categoryId: 'leisure-ent' },
  // Agriculture - Farming & Food Production
  { id: 'crop-farms', name: 'Crop Farms', categoryId: 'farming' },
  { id: 'livestock-farms', name: 'Livestock Farms', categoryId: 'farming' },
  { id: 'poultry-farms', name: 'Poultry Farms', categoryId: 'farming' },
  { id: 'fish-farms', name: 'Fish Farms', categoryId: 'farming' },
  // Agriculture - Renewable Energy
  { id: 'solar-inst', name: 'Solar Installers', categoryId: 'energy' },
  { id: 'wind-energy', name: 'Wind Energy Firms', categoryId: 'energy' },
  { id: 'ev-charging', name: 'EV Charging Providers', categoryId: 'energy' },
  // Community - Charities & NGOs
  { id: 'relief-orgs', name: 'Relief Organisations', categoryId: 'charity-ngo' },
  { id: 'comm-trusts', name: 'Community Trusts', categoryId: 'charity-ngo' },
  { id: 'foundations', name: 'Foundations', categoryId: 'charity-ngo' },
  // Community - Public & Social Services
  { id: 'care-homes', name: 'Care Homes', categoryId: 'public-svcs' },
  { id: 'supported-living', name: 'Supported Living', categoryId: 'public-svcs' },
  { id: 'social-enterp', name: 'Social Enterprises', categoryId: 'public-svcs' },
  // Online - E-Commerce
  { id: 'online-retail', name: 'Online Retailers', categoryId: 'ecommerce' },
  { id: 'dropshipping', name: 'Dropshipping Stores', categoryId: 'ecommerce' },
  { id: 'mkt-sellers', name: 'Marketplace Sellers', categoryId: 'ecommerce' },
  // Online - Digital Entrepreneurs
  { id: 'influencers', name: 'Influencers', categoryId: 'digital-ent' },
  { id: 'course-creators', name: 'Course Creators', categoryId: 'digital-ent' },
  { id: 'affiliate-mkt', name: 'Affiliate Marketers', categoryId: 'digital-ent' },
];