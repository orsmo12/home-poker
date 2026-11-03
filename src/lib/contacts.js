/* Pick friends straight from the phone's contacts (Contact Picker API).
 * Works in Chrome on Android. iPhone Safari doesn't offer it, so the button is simply hidden there.
 * The app never sees the whole address book: only the contacts the user ticks, and only name + phone. */
import { normalizePhone } from './phone';

export const contactsSupported = () => typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

/** @returns [{ name, phone (E.164 or null) }] */
export async function pickContacts(multiple = true) {
  const list = await navigator.contacts.select(['name', 'tel'], { multiple });
  return (list || []).map((c) => {
    const name = String(c.name?.[0] || '').trim().slice(0, 40);
    const phone = (c.tel || []).map((t) => normalizePhone(t)).find(Boolean) || null;
    return { name: name || (phone ? `0${phone.slice(4)}` : ''), phone };
  }).filter((c) => c.name);
}
