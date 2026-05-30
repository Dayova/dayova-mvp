import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
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
	const handleRequestClose = dismissible ? onClose : undefined;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleRequestClose}
		>
			<View className="flex-1 justify-end p-3">
				{dismissible && onClose ? (
					<Pressable
						accessibilityLabel={accessibilityLabel ?? "Dialog schließen"}
						accessibilityRole="button"
						className={cn("absolute inset-0 bg-black/30", overlayClassName)}
						onPress={onClose}
					/>
				) : (
					<View
						className={cn("absolute inset-0 bg-black/30", overlayClassName)}
					/>
				)}
				<View
					className={cn(
						"mx-8 mb-9 items-center gap-5 rounded-[30px] bg-white px-5 pt-8 pb-5",
						cardClassName,
					)}
				>
					{icon ? (
						<View
							className={cn(
								"h-[96px] w-[96px] items-center justify-center rounded-full bg-green-100 py-6",
								iconContainerClassName,
							)}
						>
							{icon}
						</View>
					) : null}
					<View className="items-center">
						<Text
							className={cn(
								"text-center font-bold font-poppins text-20 text-text",
								titleClassName,
							)}
						>
							{title}
						</Text>
						{description ? (
							<Text
								className={cn(
									"mt-2 text-center font-poppins text-14 text-text/45",
									descriptionClassName,
								)}
							>
								{description}
							</Text>
						) : null}
					</View>
					{children}
				</View>
			</View>
		</Modal>
	);
}

export { ActionModal };
