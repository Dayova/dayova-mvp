import * as React from "react";
import {
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Label } from "~/components/ui/label";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

const fieldSurfaceStyle: ViewStyle = {
  borderWidth: 1.4,
  borderColor: "rgba(17,24,39,0.06)",
  shadowColor: "#111827",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

const fieldInvalidStyle: ViewStyle = {
  borderColor: "rgba(239,68,68,0.72)",
};

function Field({ className, ...props }: ViewProps) {
  return <View className={cn("mb-6", className)} {...props} />;
}

function FieldLabel({
  className,
  icon,
  ...props
}: React.ComponentProps<typeof Label> & {
  icon?: React.ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      {icon}
      <Label
        className={cn(
          "font-poppins text-12 font-bold uppercase tracking-[1.2px] text-text",
          className,
        )}
        {...props}
      />
    </View>
  );
}

function FieldControl({
  className,
  disabled,
  invalid,
  style,
  ...props
}: ViewProps & {
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <View
      className={cn(
        "min-h-14 flex-row items-center rounded-input bg-white px-5",
        disabled && "opacity-50",
        className,
      )}
      style={[fieldSurfaceStyle, invalid && fieldInvalidStyle, style]}
      {...props}
    />
  );
}

function FieldTrigger({
  activeOpacity = 0.85,
  className,
  disabled,
  invalid,
  style,
  ...props
}: TouchableOpacityProps & {
  invalid?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      className={cn(
        "min-h-14 flex-row items-center rounded-input bg-white px-5",
        disabled && "opacity-50",
        className,
      )}
      style={[fieldSurfaceStyle, invalid && fieldInvalidStyle, style]}
      disabled={disabled}
      {...props}
    />
  );
}

function FieldAccessory({ className, ...props }: ViewProps) {
  return <View className={cn("ml-4 shrink-0", className)} {...props} />;
}

function FieldMessage({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("mt-2 ml-1 font-poppins text-12 text-destructive", className)}
      {...props}
    />
  );
}

export {
  Field,
  FieldAccessory,
  FieldControl,
  FieldLabel,
  FieldMessage,
  FieldTrigger,
};
