/**
 * What the sign-in, access, password-reset, notification and rep saves accept (11/16 audit). Kept apart from the
 * server functions so the shapes are tested without a server. The lengths are ceilings against junk, far above
 * anything real; the handlers still do the real checks (a valid username, a strong enough password, who may do it).
 */
import { z } from "zod";
import { checked } from "./checked-input";

/** A username or an email typed on the sign-in screen. */
const identity = z.string().max(320);
const email = z.string().max(320);
const token = z.string().max(200);
const userId = z.string().min(1).max(200);
const rowId = z.number().int().positive();

export const usernameInput = checked(z.object({ username: identity }));
export const identityInput = checked(z.object({ identity }));
export const inviteTokenInput = checked(z.object({ token: token.nullish() }));
export const registerInput = checked(z.object({ username: identity, email: email.nullish(), token: token.nullish() }));
export const approveInput = checked(z.object({ userId, approved: z.boolean() }));
export const canAddInput = checked(z.object({ userId, canAddCustomers: z.boolean() }));
export const roleInput = checked(z.object({ userId, role: z.enum(["admin", "sales", "service", "warehouse"]).nullable() }));
export const userIdInput = checked(z.object({ userId }));
export const createInviteInput = checked(z.object({ email: email.optional(), username: identity.optional(), canAddCustomers: z.boolean().optional() }));
export const idInput = checked(z.object({ id: rowId }));
export const resetTokenInput = checked(z.object({ token }));
/** The handler says "too long" past 128 characters; this only stops a huge body. */
export const newPasswordInput = checked(z.object({ token, password: z.string().max(1000) }));
/** A ping from a record or a comment. The note is a short reminder; 20,000 characters is far past any real one. */
export const pingInput = checked(
  z.object({
    // Blank means "nobody picked": the handler reads it as no one.
    toUserId: z.string().max(200).optional(),
    usernames: z.array(z.string().max(200)).max(200).optional(),
    body: z.string().max(20_000),
    entityType: z.string().max(100).nullish(),
    entityId: z.number().int().nullish(),
    commentId: z.number().int().nullish(),
  }),
);
export const markReadInput = checked(z.object({ id: rowId.optional(), all: z.boolean().optional() }));
export const repActiveInput = checked(z.object({ id: rowId, active: z.boolean() }));
