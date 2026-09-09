import * as Application from "expo-application";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { Platform, Share, type View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Text } from "~/components/ui/text";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";

// Public contact published at https://dayova.com/support.
const SUPPORT_EMAIL = "kontakt@dayova.de";
const SUPPORT_WEBSITE = "https://dayova.com/support";

type SupportTrigger = {
	onPress: () => void;
	busy: boolean;
	buttonRef: (node: View | null) => void;
};

/** Opens a user-editable draft. Only static screen context and app/device versions
 * are included; never pass errors, account data, or learning content as context. */
export function SupportContact({
	context,
	className,
	children,
}: {
	context: string;
	className?: string;
	children?: (trigger: SupportTrigger) => ReactNode;
}) {
	const [showFallback, setShowFallback] = useState(false);
	const [websiteError, setWebsiteError] = useState(false);
	const [shareError, setShareError] = useState(false);
	const [busy, setBusy] = useState(false);
	const inFlight = useRef(false);
	const buttonRef = useRef<View>(null);
	const setButtonRef = useCallback((node: View | null) => {
		buttonRef.current = node;
	}, []);

	const contact = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setBusy(true);
		setWebsiteError(false);
		setShareError(false);
		const body = [
			"Hallo Dayova-Team,",
			"",
			"Das funktioniert bei mir nicht:",
			"",
			"",
			`Bereich: ${context}`,
			`App-Version: ${Application.nativeApplicationVersion ?? "unbekannt"} (${Application.nativeBuildVersion ?? "unbekannt"})`,
			`System: ${Platform.OS} ${Platform.Version}`,
		].join("\n");
		try {
			const opened = await openExternalUrl(
				`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Dayova Support – ${context}`)}&body=${encodeURIComponent(body)}`,
			);
			setShowFallback(!opened);
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	};

	const openWebsite = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setBusy(true);
		try {
			const opened = await openExternalUrl(
				env.EXPO_PUBLIC_SUPPORT_URL?.trim() || SUPPORT_WEBSITE,
			);
			setWebsiteError(!opened);
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	};

	const shareAddress = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setBusy(true);
		setShareError(false);
		try {
			await Share.share({ message: SUPPORT_EMAIL });
		} catch {
			setShareError(true);
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	};

	return (
		<>
			{children ? (
				// eslint-disable-next-line react-hooks/refs -- This trigger contract only forwards event/ref callbacks to native controls; callers do not invoke them during render.
				children({
					onPress: () => void contact(),
					busy,
					buttonRef: setButtonRef,
				})
			) : (
				<Button
					ref={buttonRef}
					className={className}
					variant="neutral"
					size="sm"
					accessibilityLabel="Support kontaktieren"
					accessibilityHint="Öffnet einen E-Mail-Entwurf an das Dayova-Team."
					accessibilityState={{ busy }}
					disabled={busy}
					onPress={() => void contact()}
				>
					<Text>Support kontaktieren</Text>
				</Button>
			)}
			<DayovaSheetFrame
				visible={showFallback}
				title="Support kontaktieren"
				description="Deine E-Mail-App konnte nicht geöffnet werden. Du kannst uns auch direkt schreiben."
				onClose={() => setShowFallback(false)}
				returnFocusRef={buttonRef}
				closeAccessibilityLabel="Support schließen"
				size="medium"
				scrollable
			>
				<Text selectable className="mb-3 text-body-2 text-text">
					{SUPPORT_EMAIL}
				</Text>
				<Text className="mb-5 text-body-3 text-secondary-text">
					Beschreibe kurz das Problem. Hilfreich sind dein Gerät, die
					App-Version und ein Screenshot.
				</Text>
				<Button
					accessibilityLabel="Adresse kopieren oder teilen"
					className="mb-3"
					variant="neutral"
					onPress={() => void shareAddress()}
					disabled={busy}
					accessibilityState={{ busy }}
				>
					<Text>Adresse kopieren oder teilen</Text>
				</Button>
				{shareError ? (
					<ErrorMessage className="mb-3">
						Die Adresse konnte nicht geteilt werden. Du kannst uns direkt an
						kontakt@dayova.de schreiben.
					</ErrorMessage>
				) : null}
				<Button
					accessibilityLabel="Support-Webseite öffnen"
					variant="neutral"
					onPress={() => void openWebsite()}
					disabled={busy}
					accessibilityState={{ busy }}
				>
					<Text>Support-Webseite öffnen</Text>
				</Button>
				{websiteError ? (
					<ErrorMessage className="mt-3">
						Die Webseite konnte nicht geöffnet werden. Du kannst die
						E-Mail-Adresse oben kopieren und uns später schreiben.
					</ErrorMessage>
				) : null}
			</DayovaSheetFrame>
		</>
	);
}
