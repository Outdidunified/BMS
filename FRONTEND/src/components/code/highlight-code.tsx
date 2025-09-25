import { Icon } from "@/components/icon";
import { useCopyToClipboard } from "@/hooks";
import { useSettings } from "@/store/settingStore";
import { Button } from "@/ui/button";
import { cn } from "@/utils";
import { useState, useEffect } from "react";
import { createHighlighter } from "shiki/bundle/web";
import type { HighlightCodeProps } from ".";

export function HighlightCode({ code, options, className, withCopy = true }: HighlightCodeProps) {
	const { copyFn } = useCopyToClipboard();
	const [hovered, setHovered] = useState(false);
	const { themeMode } = useSettings();
	const [highlighter, setHighlighter] = useState<any>(null);
	const [html, setHtml] = useState<string>("");

	// Initialize highlighter once
	useEffect(() => {
		createHighlighter({
			langs: ["javascript", "typescript", "jsx", "tsx"],
			themes: ["min-dark", "snazzy-light"],
		}).then((hl) => {
			setHighlighter(hl);
			const highlighted = hl.codeToHtml(code, {
				lang: options?.lang || "typescript",
				theme: options?.theme || (themeMode === "dark" ? "min-dark" : "snazzy-light"),
				transformers: [
					{
						pre(node) {
							this.addClassToHast(node, "p-3 rounded-md");
						},
					},
				],
				...options,
			});
			setHtml(highlighted);
		});
	}, [code, options, themeMode]);

	if (!highlighter) return <div className="p-3 rounded-md bg-gray-800 text-white">Loading...</div>;

	return (
		<div
			className={cn("w-full relative group", className)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{withCopy && hovered && (
				<Button
					variant="outline"
					size="icon"
					className="absolute top-2 right-2 bg-accent"
					onClick={() => copyFn(code)}
				>
					<Icon icon="eva:copy-fill" size={24} />
				</Button>
			)}
			<div
				// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}
