window.__ModuleLoader__.load({
	id: "dsh-image-tools",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let { useState, useEffect } = react;
		let { jsx, jsxs, Fragment } = react_jsx_runtime;
		let { DisclosureRow, StateDot, IconDataOutline16, IconInspectOutline12, IconChevronDownOutline14 } = _primitives;

		// ── locale dictionaries (zh is the key-set source of truth) ──────────────
		const NS = "image";
		const zh = {
			"row.info": "图片信息",
			"row.preview": "图片预览",
			"row.resize": "调整尺寸",
			"row.convert": "转换格式",
			"row.crop": "裁剪",
			"row.rotate": "旋转",
			"row.running": "正在处理图片…",
			"row.failed": "图片处理失败",
			"row.stopped": "图片处理已中止",
			"row.loading": "正在加载图片…",
			"row.noSession": "缺少图片所属会话上下文",
			"row.output": "输出",
			"row.inspect": "检查"
		};
		const en = {
			"row.info": "Image info",
			"row.preview": "Image preview",
			"row.resize": "Resize",
			"row.convert": "Convert",
			"row.crop": "Crop",
			"row.rotate": "Rotate",
			"row.running": "Processing image…",
			"row.failed": "Image processing failed",
			"row.stopped": "Image processing stopped",
			"row.loading": "Loading image…",
			"row.noSession": "No session context for image",
			"row.output": "Output",
			"row.inspect": "Inspect"
		};

		/** Display titles per wire tool name. */
		const TOOL_TITLES = {
			image_info: "Info",
			image_preview: "Preview",
			image_resize: "Resize",
			image_convert: "Convert",
			image_crop: "Crop",
			image_rotate: "Rotate"
		};
		const TOOL_KEYS = ["image_info", "image_preview", "image_resize", "image_convert", "image_crop", "image_rotate"];

		// ── pure row model (mirrors ui-tool's frozen-call slice handling) ────────
		function parseArgs(raw) {
			try {
				return JSON.parse(raw);
			} catch {
				return void 0;
			}
		}
		function firstLine(text) {
			const nl = text.indexOf("\n");
			return nl === -1 ? text : text.slice(0, nl);
		}
		function relativizeToCwd(text, cwd) {
			if (cwd === void 0 || cwd === "") return text;
			const root = cwd.replace(/[/\\]+$/, "");
			if (text.startsWith(root + "/") || text.startsWith(root + "\\")) return text.slice(root.length + 1);
			return text;
		}
		/** Flatten a settled result's content blocks; image blocks become a short summary line. */
		function resultText(node) {
			const parts = [];
			for (const block of node.content) {
				if (block.type === "text") parts.push(block.text);
				else if (block.type === "image" && block.attachment !== void 0) parts.push(`[image ${block.attachment.mediaType} ${block.attachment.width}x${block.attachment.height}]`);
				else parts.push(JSON.stringify(block, null, 2));
			}
			if (parts.length === 0 && node.error !== void 0) parts.push(node.error.name + ": " + node.error.code);
			return parts.join("\n");
		}
		function imageRefs(block) {
			if (!Array.isArray(block.content)) return [];
			const refs = [];
			for (const item of block.content) if (item.type === "image" && item.attachment !== void 0 && item.attachment.attachmentId !== void 0) refs.push(item.attachment);
			return refs;
		}
		/** Derive the display state without consulting any live service. */
		function rowModel(block, toolName, cwd) {
			const done = "kind" in block;
			const argsRaw = (done ? block.call?.argsRaw : block.argsRaw) ?? "";
			const state = !done ? "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
			const args = parseArgs(argsRaw);
			let summary = "";
			if (args !== void 0 && typeof args === "object" && args !== null) {
				const path = typeof args.path === "string" ? relativizeToCwd(args.path, cwd) : "";
				if (toolName === "image_resize") summary = `${path} → ${args.width ?? "auto"}x${args.height ?? "auto"}`;
				else if (toolName === "image_convert") summary = `${path} → ${typeof args.format === "string" ? args.format.toUpperCase() : ""}`;
				else if (toolName === "image_crop") summary = `${path} · ${args.width ?? ""}x${args.height ?? ""}`;
				else if (toolName === "image_rotate") summary = `${path} · ${args.degrees !== void 0 ? `${args.degrees}°` : "auto"}`;
				else summary = path;
				if (summary === "") summary = firstLine(argsRaw);
			} else {
				summary = argsRaw === "" ? block.callId : firstLine(argsRaw);
			}
			return {
				state,
				summary,
				output: done ? resultText(block) || null : null,
				images: done ? imageRefs(block) : []
			};
		}

		/** State substitution for the collapsed leading icon. */
		function leadingFor(state) {
			switch (state) {
				case "error": return jsx(StateDot, { state: "error" });
				case "stopped": return jsx(StateDot, { state: "warning" });
				default: return jsx(IconDataOutline16, { size: 14 });
			}
		}

		/** Resolve one durable image reference into browser-consumable bytes. */
		function bytesToBase64(bytes) {
			let binary = "";
			for (const byte of bytes) binary += String.fromCharCode(byte);
			return btoa(binary);
		}
		function AttachmentImage({ sessionId, attachment, sessions, t }) {
			const [url, setUrl] = useState(null);
			const [error, setError] = useState(null);
			useEffect(() => {
				let cancelled = false;
				let objectUrl = null;
				(async () => {
					try {
						const binding = sessions?.binding?.(sessionId);
						const session = binding?.session;
						if (session === void 0) throw new Error(t("row.noSession"));
						const result = await session.readAttachment(attachment.attachmentId);
						if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
						if (cancelled) return;
						const bytes = Uint8Array.from(result.value.data);
						if (typeof URL.createObjectURL === "function") {
							objectUrl = URL.createObjectURL(new Blob([bytes.buffer], { type: result.value.attachment.mediaType }));
							setUrl(objectUrl);
						} else {
							setUrl(`data:${result.value.attachment.mediaType};base64,${bytesToBase64(bytes)}`);
						}
					} catch (err) {
						if (!cancelled) setError(String(err?.message ?? err));
					}
				})();
				return () => {
					cancelled = true;
					if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
				};
			}, [sessionId, attachment.attachmentId, sessions, t]);
			if (error !== null) return jsx("div", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12, lineHeight: "18px", margin: "6px 0" }, children: error });
			if (url === null) return jsx("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, lineHeight: "18px", margin: "6px 0" }, children: t("row.loading") });
			return jsx("img", { src: url, alt: attachment.name ?? attachment.mediaType, style: { maxWidth: "100%", maxHeight: 320, borderRadius: 8, display: "block", margin: "6px 0" } });
		}

		/** One keyed toolview row for an image tool call. */
		function ImageToolRow({ block, toolName, cwd, sessionId, inspect, sessions, t }) {
			const model = rowModel(block, toolName, cwd);
			const [open, setOpen] = useState(false);
			const expandable = model.output !== null || model.images.length > 0;
			const status = model.state === "running" ? t("row.running") : model.state === "error" ? t("row.failed") : model.state === "stopped" ? t("row.stopped") : null;
			const title = `${TOOL_TITLES[toolName] ?? toolName} · ${model.summary}`;
			return jsxs("div", {
				"data-tool": toolName,
				"data-state": model.state,
				children: [
					jsx(DisclosureRow, {
						icon: leadingFor(model.state),
						title,
						open: open && expandable,
						expandable,
						onToggle: () => setOpen((value) => !value),
						expandOnRowClick: true,
						collapsedContent: status === null ? null : jsx("span", { className: "visuallyHidden", children: status })
					}, "row"),
					open && expandable ? jsxs("div", { style: { display: "flex", flexDirection: "column", margin: "2px 0 6px 30px" }, children: [
						model.images.map((attachment) => jsx(AttachmentImage, { sessionId, attachment, sessions, t }, attachment.attachmentId)),
						model.output !== null ? jsxs("div", { children: [
							jsx("div", { style: { color: "var(--dsw-alias-label-caption)", fontSize: 11, margin: "6px 0 2px" }, children: t("row.output") }),
							jsx("pre", { style: { background: "var(--dsw-alias-markdown-code-block)", color: model.state === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word", borderRadius: 12, margin: 0, padding: "12px 14px", fontSize: 12, lineHeight: "18px", maxHeight: 260, overflow: "auto" }, children: model.output })
						] }) : null,
						inspect !== void 0 ? jsx("button", {
							type: "button",
							onClick: inspect,
							style: { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: 12, padding: "4px 0" },
							children: [jsx(IconInspectOutline12, {}), t("row.inspect")]
						}) : null
					] }) : null
				]
			});
		}

		/** Required services: the slot registry, the locale seat, and the sessions face for attachment reads. */
		const inject = ["slots", "locale", "sessions"];

		/**
		* Client plugin body: register the dictionaries and a keyed tool row for
		* every image tool, rendering the result's native image block inline.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "image-tools: dictionaries");
			const sessions = ctx.get("sessions");
			for (const key of TOOL_KEYS) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					locale: NS
				}, (props) => jsx(ImageToolRow, { ...props, sessions })));
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
