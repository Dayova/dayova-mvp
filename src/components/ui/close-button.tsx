import { NavigationIconButton } from "~/components/ui/button";

type CloseButtonProps = Omit<
	React.ComponentProps<typeof NavigationIconButton>,
	"kind" | "children" | "className" | "style" | "iconSize" | "strokeWidth"
>;

function CloseButton(props: CloseButtonProps) {
	return <NavigationIconButton kind="close" {...props} />;
}

export { CloseButton };
