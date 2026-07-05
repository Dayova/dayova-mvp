import type { ReactNode } from "react";
import { View } from "react-native";
import { BottomModal } from "~/components/ui/bottom-modal";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

type ActionModalProps = {
	visible: boolean;
	title: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	children?: ReactNode;
	dismissible?: boolean;
	onClose?: () => void;
	accessibilityLabel?: string;
	overlayClassName?: string;
	cardClassName?: string;
	iconContainerClassName?: string;
	titleClassName?: string;
	descriptionClassName?: string;
};

function ActionModal({
	visible,
	title,
	description,
	icon,
	children,
	dismissible = false,
	onClose,
	accessibilityLabel,
	overlayClassName,
	cardClassName,
	iconContainerClassName,
	titleClassName,
	descriptionClassName,
}: ActionModalProps) {
	const closeAccessibilityLabel = accessibilityLabel ?? "Dialog schließen";
	const canClose = dismissible && Boolean(onClose);

	return (
		<BottomModal
			visible={visible}
			dismissible={dismissible}
			onClose={canClose ? onClose : undefined}
			closeAccessibilityLabel={closeAccessibilityLabel}
			overlayClassName={overlayClassName}
			sheetClassName={cardClassName}
			contentClassName="gap-5"
			showCloseButton={canClose}
		>
			{icon ? (
				<View
					className={cn(
						"h-16 w-16 items-center justify-center rounded-full bg-success-subtle",
						iconContainerClassName,
					)}
				>
					{icon}
				</View>
			) : null}
			<View className="gap-3">
				<Text
					className={cn(
						"font-poppins font-semibold text-body-1 text-text",
						titleClassName,
					)}
				>
					{title}
				</Text>
				{description ? (
					<Text
						className={cn(
							"font-poppins text-body-2 text-secondary-text",
							descriptionClassName,
						)}
					>
						{description}
					</Text>
				) : null}
			</View>
			{children ? <View className="w-full">{children}</View> : null}
		</BottomModal>
	);
}

export { ActionModal };
