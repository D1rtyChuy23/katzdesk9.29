/**
 * What the Out Of Network saves accept (11/16 audit): the provider form, its coverage, people and addresses, and
 * the providers on an account. The lengths are ceilings against junk, far above anything real; the handlers still
 * trim, tidy and check for duplicates.
 */
import { z } from "zod";
import { checked } from "./checked-input";
import { PROVIDER_ROLES } from "./network";

const rowId = z.number().int().positive();
/** A one-line field: a name, a phone, a rate. */
const line = z.string().max(2_000);
/** A free-text field: notes, coverage, what they service. */
const prose = z.string().max(200_000);
const role = z.enum(PROVIDER_ROLES);

const location = z.object({ state: line, city: line.nullable(), zip: line.nullable() });
const contact = z.object({ name: line.nullable(), role: line.nullable(), phone: line.nullable(), email: line.nullable() });
const address = z.object({
  label: line.nullable(),
  line1: line.nullable(),
  line2: line.nullable(),
  city: line.nullable(),
  state: line.nullable(),
  zip: line.nullable(),
});

export const customerInput = checked(z.object({ customer: line }));

export const providerInput = checked(
  z.object({
    id: rowId.optional(),
    name: line,
    status: line.nullish(),
    dispatchPhone: line.nullish(),
    dispatchEmail: line.nullish(),
    secondaryPhone: line.nullish(),
    secondaryEmail: line.nullish(),
    responseTime: prose.nullish(),
    standardRate: prose.nullish(),
    afterHoursRate: prose.nullish(),
    travelPolicy: prose.nullish(),
    equipmentServiced: prose.nullish(),
    coverage: prose.nullish(),
    contacts: prose.nullish(),
    pmPricing: prose.nullish(),
    partsStocking: prose.nullish(),
    notes: prose.nullish(),
    // Only sent with a new provider; an existing one saves each of these on its own.
    locations: z.array(location).max(5_000).optional(),
    people: z.array(contact).max(5_000).optional(),
    addresses: z.array(address).max(5_000).optional(),
  }),
);

export const renameProviderInput = checked(z.object({ id: rowId, name: line }));
/** `zip` may hold several ZIP codes, split by the handler. */
export const providerLocationInput = checked(z.object({ providerId: rowId, state: line, city: line.nullish(), zip: prose.nullish() }));
export const providerContactInput = checked(contact.extend({ providerId: rowId }));
export const providerAddressInput = checked(address.extend({ providerId: rowId }));
export const assignProviderInput = checked(z.object({ customer: line, providerId: rowId, role: role.optional() }));
export const linkIdInput = checked(z.object({ linkId: rowId }));
export const providerRoleInput = checked(z.object({ linkId: rowId, role }));
