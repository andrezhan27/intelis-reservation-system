import {
  isValidPhoneNumber as isValidPhoneNumberWithMetadata,
  parsePhoneNumberFromString,
  type CountryCode
} from "libphonenumber-js/min";

const emailLocalPartPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const domainLabelPattern = /^[a-z0-9-]+$/i;
const topLevelDomainPattern = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

export function formatPhoneForSubmission(
  countryId: string,
  dialCode: string,
  phone: string
) {
  const trimmedPhone = phone.trim();
  const phoneToParse = trimmedPhone.startsWith("00")
    ? `+${trimmedPhone.slice(2)}`
    : trimmedPhone;
  const parsedPhone = parsePhoneNumberFromString(
    phoneToParse,
    countryId as CountryCode
  );

  if (parsedPhone) {
    return parsedPhone.number;
  }

  if (trimmedPhone.startsWith("+")) {
    return `+${trimmedPhone.slice(1).replace(/\D/g, "")}`;
  }

  if (trimmedPhone.startsWith("00")) {
    return `+${trimmedPhone.slice(2).replace(/\D/g, "")}`;
  }

  return `${dialCode}${trimmedPhone.replace(/\D/g, "")}`;
}

export function isValidPhoneNumberForCountry(
  countryId: string,
  dialCode: string,
  phone: string
) {
  return (
    /^[\d\s()+.-]+$/.test(phone.trim()) &&
    isValidInternationalPhoneNumber(
      formatPhoneForSubmission(countryId, dialCode, phone)
    )
  );
}

export function isValidInternationalPhoneNumber(phone: string) {
  const normalizedPhone = phone.trim();

  return (
    /^\+[1-9]\d{7,14}$/.test(normalizedPhone) &&
    isValidPhoneNumberWithMetadata(normalizedPhone)
  );
}

export function isValidEmailAddress(email: string) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail || normalizedEmail.length > 254) {
    return false;
  }

  const atIndex = normalizedEmail.indexOf("@");

  if (atIndex <= 0 || atIndex !== normalizedEmail.lastIndexOf("@")) {
    return false;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !emailLocalPartPattern.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split(".");

  if (domain.length > 253 || labels.length < 2) {
    return false;
  }

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !domainLabelPattern.test(label)
    )
  ) {
    return false;
  }

  return topLevelDomainPattern.test(labels[labels.length - 1]);
}
