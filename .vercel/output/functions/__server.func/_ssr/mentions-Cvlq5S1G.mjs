//#region node_modules/.nitro/vite/services/ssr/assets/mentions-Cvlq5S1G.js
/** @username tokens in a ping or handoff note. */
function parseMentions(text) {
	const found = [];
	const seen = /* @__PURE__ */ new Set();
	const re = /@([a-zA-Z0-9._-]{2,32})\b/g;
	let m;
	while (m = re.exec(text)) {
		const name = m[1].toLowerCase();
		if (seen.has(name)) continue;
		seen.add(name);
		found.push(m[1]);
	}
	return found;
}
function mentionFragment(text) {
	const m = text.match(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/);
	return m ? m[2] : null;
}
function applyMention(text, username) {
	if (/(^|\s)@([a-zA-Z0-9._-]{0,32})$/.test(text)) return text.replace(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/, `$1@${username} `);
	return `${text}${text && !text.endsWith(" ") ? " " : ""}@${username} `;
}
//#endregion
export { mentionFragment as n, parseMentions as r, applyMention as t };
