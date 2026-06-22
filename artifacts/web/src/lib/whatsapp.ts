// WhatsApp click-to-chat deep link. This is the single seam for WhatsApp:
// today it opens the app with a pre-filled message (the person taps send);
// swapping to the WhatsApp Business API later means changing only this file.
//
// Phone numbers should include a country code (e.g. 57 for Colombia). We strip
// non-digits; if no phone is given, wa.me opens a contact picker.
export function buildWhatsAppLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
