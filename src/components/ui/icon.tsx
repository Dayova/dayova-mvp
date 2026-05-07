import {
	AlertCircleIcon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
	ArrowUpRight01Icon,
	BookOpen01Icon,
	Camera01Icon,
	CalendarAdd01Icon,
	Calendar03Icon,
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Clock03Icon,
	CogIcon,
	Delete02Icon,
	File01Icon,
	FlashIcon,
	Home01Icon,
	Logout03Icon,
	Mail01Icon,
	MailValidation01Icon,
	Mortarboard01Icon,
	MoreHorizontalIcon,
	NotebookIcon,
	Notification01Icon,
	PlusSignIcon,
	Route02Icon,
	ShieldCheck as ShieldCheckIcon,
	SparklesIcon,
	Task01Icon,
	TelephoneIcon,
	Tick02Icon,
	UserCircleIcon,
	ViewIcon,
	ViewOffIcon,
	ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type HugeiconsProps } from "@hugeicons/react-native";

type IconProps = Omit<HugeiconsProps, "icon">;

const createIcon = (icon: HugeiconsProps["icon"]) => (props: IconProps) => (
	<HugeiconsIcon icon={icon} {...props} />
);

export const ArrowLeft = createIcon(ArrowLeft01Icon);
export const ArrowRight = createIcon(ArrowRight01Icon);
export const ArrowUpRight = createIcon(ArrowUpRight01Icon);
export const Bell = createIcon(Notification01Icon);
export const BookOpen = createIcon(BookOpen01Icon);
export const Camera = createIcon(Camera01Icon);
export const CalendarAdd = createIcon(CalendarAdd01Icon);
export const CalendarDays = createIcon(Calendar03Icon);
export const Check = createIcon(Tick02Icon);
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon);
export const ChevronDown = createIcon(ArrowDown01Icon);
export const CircleAlert = createIcon(AlertCircleIcon);
export const ClipboardList = createIcon(Task01Icon);
export const Clock3 = createIcon(Clock03Icon);
export const Eye = createIcon(ViewIcon);
export const EyeOff = createIcon(ViewOffIcon);
export const FileText = createIcon(File01Icon);
export const GraduationCap = createIcon(Mortarboard01Icon);
export const Home = createIcon(Home01Icon);
export const Logout = createIcon(Logout03Icon);
export const Mail = createIcon(Mail01Icon);
export const MailCheck = createIcon(MailValidation01Icon);
export const MoreHorizontal = createIcon(MoreHorizontalIcon);
export const NotebookPen = createIcon(NotebookIcon);
export const Phone = createIcon(TelephoneIcon);
export const Plus = createIcon(PlusSignIcon);
export const Route2 = createIcon(Route02Icon);
export const Settings = createIcon(CogIcon);
export const ShieldCheck = createIcon(ShieldCheckIcon);
export const Sparkles = createIcon(SparklesIcon);
export const Timer = createIcon(Clock03Icon);
export const Trash2 = createIcon(Delete02Icon);
export const UserRound = createIcon(UserCircleIcon);
export const X = createIcon(Cancel01Icon);
export const Zap = createIcon(FlashIcon);
