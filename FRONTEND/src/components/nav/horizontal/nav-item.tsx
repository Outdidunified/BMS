import Icon from "@/components/icon/icon";
import useLocale from "@/locales/use-locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { cn } from "@/utils";
import { NavItemRenderer } from "../components";
import { navItemClasses, navItemStyles } from "../styles";
import type { NavItemProps } from "../types";

export const NavItem = (item: NavItemProps) => {
	const { t } = useLocale();

	const content = (
		<>
			{/* Icon */}
			<span
				style={navItemStyles.icon}
				className="flex items-center justify-center shrink-0"
			>
				{item.icon && typeof item.icon === "string" ? (
					<Icon icon={item.icon} />
				) : (
					item.icon
				)}
			</span>

			{/* Title */}
			<span
				style={navItemStyles.title}
				className="ml-3 flex-auto leading-[1.5] relative top-[1px]"
			>
				{t(item.title)}
			</span>

			{/* Caption */}
			{item.caption && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger>
							<Icon
								icon="solar:info-circle-linear"
								size={16}
								className="ml-2 relative top-[2px]"
								style={navItemStyles.caption}
							/>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{t(item.caption)}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}

			{/* Info */}
			{item.info && (
				<span
					style={navItemStyles.info}
					className="ml-2 text-xs opacity-70 relative top-[1px]"
				>
					{item.info}
				</span>
			)}

			{/* Arrow */}
			{item.hasChild && <ItemIcon depth={item.depth} />}
		</>
	);

	const itemClassName = cn(
		navItemClasses.base,
		navItemClasses.hover,
		"min-h-[40px] max-w-[260px] px-3 py-2 flex items-center gap-2", // spacing + alignment
		item.active && item.depth === 1 && navItemClasses.active,
		item.active && item.depth !== 1 && "bg-action-hover!",
		item.disabled && navItemClasses.disabled,
	);

	return (
		<NavItemRenderer item={item} className={itemClassName}>
			{content}
		</NavItemRenderer>
	);
};

const ItemIcon = ({ depth = 1 }: { depth?: number }) => {
	const icon =
		depth === 1
			? "eva:arrow-ios-downward-fill"
			: "eva:arrow-ios-forward-fill";
	return <Icon icon={icon} style={navItemStyles.arrow} className="ml-2 relative top-[1px]" />;
};
