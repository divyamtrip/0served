export type ReportStatus = 'draft' | 'published' | 'archived';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'owner' | 'editor';
  status: 'active' | 'suspended';
  created_at: string;
  last_login_at: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  display_order: number;
  is_active: number; // 1 or 0
  created_at: string;
  updated_at: string;
  report_count?: number;
}

export interface Report {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  summary: string;
  content: string;
  category_id: string | null;
  category_name: string;
  status: ReportStatus;
  author: string;
  reading_time_minutes: number;
  cover_image_url: string;
  pdf_attachment_url: string;
  seo_title: string;
  seo_description: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  report_id: string | null;
  alt_text: string;
  created_at: string;
}

export interface SiteSettings {
  site_title: string;
  site_tagline: string;
  site_description: string;
  site_domain: string;
  contact_email: string;
  contact_response_time: string;
  twitter_url: string;
  linkedin_url: string;
  github_url: string;
  featured_report_id: string;
  about_mission: string;
  about_methodology: string;
  about_principles: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  organization: string;
  inquiry_type: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  ip_address: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}
