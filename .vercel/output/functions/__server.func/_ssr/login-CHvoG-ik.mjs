import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as signIn, t as authClient } from "./client-sGid3STf.mjs";
import { a as lookupSignIn, o as registerAccount, r as getMyAccess, t as checkUsername } from "./access-Cv44_4sH.mjs";
import { t as GROK_PROVIDERS } from "./server-IL_x5yy_.mjs";
import { n as useCurrentUserState } from "./use-current-user-DZ7NZd4-.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { n as Label, t as Input } from "./input-D-eo25vp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CHvoG-ik.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PENDING_KEY = "katz-desk-pending";
function readPending() {
	if (typeof window === "undefined") return false;
	try {
		return window.sessionStorage.getItem(PENDING_KEY) === "1";
	} catch {
		return false;
	}
}
function writePending(on) {
	if (typeof window === "undefined") return;
	try {
		if (on) window.sessionStorage.setItem(PENDING_KEY, "1");
		else window.sessionStorage.removeItem(PENDING_KEY);
	} catch {}
}
function Login() {
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const router = useRouter();
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (readPending()) setMode("pending");
	}, []);
	(0, import_react.useEffect)(() => {
		if (isPending || !user || mode === "pending" || mode === "up") return;
		(async () => {
			try {
				if (!(await getMyAccess()).approved) {
					writePending(true);
					setMode("pending");
					return;
				}
				writePending(false);
				navigate({ to: "/" });
			} catch {}
		})();
	}, [
		isPending,
		user,
		navigate,
		mode
	]);
	async function dropSession() {
		try {
			await authClient.signOut();
		} catch {}
	}
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			if (mode === "up") {
				const name = username.trim();
				if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
				if (!(await checkUsername({ data: { username: name } })).available) throw new Error("That username is already taken.");
				const res = await authClient.signUp.email({
					email: email.trim(),
					password,
					name
				});
				if (res.error) throw new Error(res.error.message);
				await authClient.getSession();
				const access = await registerAccount({ data: {
					username: name,
					email: email.trim()
				} });
				await router.invalidate();
				if (!access.approved) {
					writePending(true);
					await dropSession();
					setMode("pending");
					return;
				}
				writePending(false);
				navigate({ to: "/" });
			} else {
				const looked = await lookupSignIn({ data: { username: username.trim() } });
				const res = await authClient.signIn.email({
					email: looked.email,
					password
				});
				if (res.error) throw new Error(res.error.message);
				await authClient.getSession();
				await router.invalidate();
				writePending(false);
				navigate({ to: "/" });
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Sign-in failed";
			if (/waiting for approval/i.test(msg)) {
				writePending(true);
				setMode("pending");
				return;
			}
			setError(msg);
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "min-h-svh bg-ink text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid min-h-svh max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.22em] text-cream/50 uppercase",
					children: "Katz Coffee · Houston"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "mt-4 font-display text-5xl leading-[1.05] font-medium tracking-tight",
					children: ["Katz ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "italic text-cream/70",
						children: "Desk"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-md text-base leading-relaxed text-cream/70",
					children: "One desk for sales and service. Past due, coming due, recipes, and the handoff between the two teams — without the spreadsheet pile-up."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-cream/12 bg-cream/6 p-6",
				children: mode === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Waiting for approval"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-cream/60",
						children: "Your account was created. A desk admin will review it before you can open Katz Desk. Sign in with your username after you’re approved."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							className: "w-full",
							onClick: () => {
								(async () => {
									try {
										await authClient.getSession();
										if ((await getMyAccess()).approved) {
											writePending(false);
											navigate({ to: "/" });
										}
									} catch {}
								})();
							},
							children: "Check again"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							className: "w-full",
							variant: "secondary",
							onClick: () => {
								writePending(false);
								setMode("in");
								setPassword("");
							},
							children: "Back to sign in"
						})]
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: mode === "up" ? "Create an account" : "Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-cream/60",
						children: mode === "up" ? "Pick a username and any email. New accounts wait for an admin to approve them." : "Sign in with your username. New accounts need approval before they can open the desk."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit,
						className: "mt-5 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "username",
								className: "text-cream/60",
								children: "Username"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "username",
								required: true,
								autoComplete: "username",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: username,
								onChange: (e) => setUsername(e.target.value),
								placeholder: "e.g. amanda.s"
							})] }),
							mode === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "email",
								className: "text-cream/60",
								children: "Email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "email",
								type: "email",
								required: true,
								autoComplete: "email",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: email,
								onChange: (e) => setEmail(e.target.value),
								placeholder: "Any email you use"
							})] }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "password",
								className: "text-cream/60",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "password",
								type: "password",
								required: true,
								minLength: 8,
								autoComplete: mode === "up" ? "new-password" : "current-password",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: password,
								onChange: (e) => setPassword(e.target.value)
							})] }),
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-destructive",
								children: error
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								className: "w-full",
								disabled: busy,
								children: mode === "up" ? "Create account" : "Sign in"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-4 text-sm text-cream/60 underline-offset-2 hover:underline",
						onClick: () => {
							setMode(mode === "in" ? "up" : "in");
							setError(null);
						},
						children: mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "my-5 flex items-center gap-3 text-xs text-cream/40",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-cream/15" }),
							"or",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-cream/15" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "secondary",
							className: "w-full",
							onClick: () => void signIn(p.providerId, {
								callbackURL: "/",
								errorCallbackURL: "/login"
							}).catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed")),
							children: ["Continue with ", p.label]
						}, p.providerId))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-xs leading-relaxed text-cream/40",
						children: "Google and X still work if you already use them. New username accounts wait for approval."
					})
				] })
			})]
		})
	});
}
//#endregion
export { Login as component };
