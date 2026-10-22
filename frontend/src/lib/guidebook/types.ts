/** A guidebook row as returned by Supabase with its property and host embedded. */
export interface GuidebookRow {
  id: string;
  template_key: string | null;
  included_tabs: unknown;
  check_in_time: string | null;
  check_out_time: string | null;
  access_info: string | null;
  parking_info: string | null;
  welcome_info: string | null;
  cover_image_url: string | null;
  safety_info: unknown;
  things_to_do: unknown;
  places_to_eat: unknown;
  checkout_info: unknown;
  house_manual: unknown;
  rules_json: unknown;
  wifi_json: unknown;
  custom_sections: unknown;
  custom_tabs_meta: unknown;
  created_time: string | null;
  last_modified_time: string | null;
  user_id: string | null;
  public_slug: string | null;
  property: {
    id: number;
    name: string | null;
    address_street: string | null;
    address_city_state: string | null;
    address_zip: string | null;
  } | null;
  host: {
    id: number;
    name: string | null;
    bio: string | null;
    contact: string | null;
    host_image_url: string | null;
  } | null;
}
