import {
	AlertCircleIcon,
	ArrowDown01Icon,
	ArrowLeft01Icon,
	ArrowUpRight01Icon,
	Attachment01Icon,
	BookOpen01Icon,
	Calculator01Icon,
	Calendar03Icon,
	CalendarAdd01Icon,
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Chemistry01Icon,
	Clock03Icon,
	CodeIcon,
	Delete02Icon,
	Dna01Icon,
	EarthIcon,
	FlashIcon,
	FootballIcon,
	Home02Icon,
	LanguageCircleIcon,
	Logout03Icon,
	Mail01Icon,
	MailValidation01Icon,
	MapsCircle01Icon,
	Mic01Icon,
	Mortarboard01Icon,
	MusicNote01Icon,
	NotebookIcon,
	Notification01Icon,
	PaintBrush01Icon,
	PencilIcon,
	PlusSignIcon,
	PropertyEditIcon,
	Route02Icon,
	ScanImageIcon,
	Settings01Icon,
	ShieldCheck as ShieldCheckIcon,
	Task01Icon,
	TaskEdit01Icon,
	Tick02Icon,
	TimeManagementCircleIcon,
	UserCircleIcon,
	ViewIcon,
	ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type HugeiconsProps } from "@hugeicons/react-native";

type IconProps = Omit<HugeiconsProps, "icon">;

const createIcon = (icon: HugeiconsProps["icon"]) => (props: IconProps) => (
	<HugeiconsIcon icon={icon} {...props} />
);

export const Attachment = createIcon(Attachment01Icon);
export const ArrowLeft = createIcon(ArrowLeft01Icon);
export const ArrowUpRight = createIcon(ArrowUpRight01Icon);
export const Bell = createIcon(Notification01Icon);
export const BookOpen = createIcon(BookOpen01Icon);
export const CalendarAdd = createIcon(CalendarAdd01Icon);
export const CalendarDays = createIcon(Calendar03Icon);
export const Calculator = createIcon(Calculator01Icon);
export const Check = createIcon(Tick02Icon);
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon);
export const Chemistry = createIcon(Chemistry01Icon);
export const ChevronDown = createIcon(ArrowDown01Icon);
export const CircleAlert = createIcon(AlertCircleIcon);
export const ClipboardList = createIcon(Task01Icon);
export const ClipboardEdit = createIcon(TaskEdit01Icon);
export const Clock3 = createIcon(Clock03Icon);
export const Code = createIcon(CodeIcon);
export const Dna = createIcon(Dna01Icon);
export const Earth = createIcon(EarthIcon);
export const Eye = createIcon(ViewIcon);
export const EyeOff = createIcon(ViewOffIcon);
export const Football = createIcon(FootballIcon);
export const GraduationCap = createIcon(Mortarboard01Icon);
export const Home = createIcon(Home02Icon);
export const Language = createIcon(LanguageCircleIcon);
export const Logout = createIcon(Logout03Icon);
export const Maps = createIcon(MapsCircle01Icon);
export const Mail = createIcon(Mail01Icon);
export const MailCheck = createIcon(MailValidation01Icon);
export const Mic = createIcon(Mic01Icon);
export const MusicNote = createIcon(MusicNote01Icon);
export const NotebookPen = createIcon(NotebookIcon);
export const PaintBrush = createIcon(PaintBrush01Icon);
export const Pencil = createIcon(PencilIcon);
export const Plus = createIcon(PlusSignIcon);
export const PropertyEdit = createIcon(PropertyEditIcon);
export const Route2 = createIcon(Route02Icon);
export const ScanImage = createIcon(ScanImageIcon);
export const Settings = createIcon(Settings01Icon);
export const ShieldCheck = createIcon(ShieldCheckIcon);
export const TimeManagement = createIcon(TimeManagementCircleIcon);
export const Timer = createIcon(Clock03Icon);
export const Trash2 = createIcon(Delete02Icon);
export const UserRound = createIcon(UserCircleIcon);
export const X = createIcon(Cancel01Icon);
export const Zap = createIcon(FlashIcon);
