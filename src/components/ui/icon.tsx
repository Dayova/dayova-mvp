import {
	AlertCircleIcon,
	ArrowDown01Icon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
	ArrowUpRight01Icon,
	Attachment01Icon,
	Atom02Icon,
	Backpack03Icon,
	BookOpen01Icon,
	BulbIcon,
	Calculator01Icon,
	Calendar03Icon,
	Cancel01Icon,
	Chemistry01Icon,
	Clock03Icon,
	CodeIcon,
	ComputerIcon,
	Delete02Icon,
	Dna01Icon,
	Dumbbell02Icon,
	EarthIcon,
	FootballIcon,
	GreekHelmetIcon,
	GlobeIcon,
	Home02Icon,
	LanguageCircleIcon,
	Logout03Icon,
	Mail01Icon,
	MapsCircle01Icon,
	Mic01Icon,
	Mortarboard01Icon,
	Moon02Icon,
	MusicNote01Icon,
	NotebookIcon,
	NoteIcon,
	PaintBoardIcon,
	Notification01Icon,
	PaintBrush01Icon,
	PencilIcon,
	Plant04Icon,
	PlusSignIcon,
	PropertyEditIcon,
	Rocket01Icon,
	Route02Icon,
	ScanImageIcon,
	Settings01Icon,
	SquareLock02Icon,
	SquareRootSquareIcon,
	Sun01Icon,
	Task01Icon,
	TaskEdit01Icon,
	Telescope01Icon,
	Tick02Icon,
	Time04Icon,
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
export const Atom = createIcon(Atom02Icon);
export const ArrowLeft = createIcon(ArrowLeft01Icon);
export const ArrowRight = createIcon(ArrowRight01Icon);
export const ArrowUpRight = createIcon(ArrowUpRight01Icon);
export const Backpack = createIcon(Backpack03Icon);
export const Bell = createIcon(Notification01Icon);
export const BookOpen = createIcon(BookOpen01Icon);
export const Bulb = createIcon(BulbIcon);
export const CalendarDays = createIcon(Calendar03Icon);
export const Calculator = createIcon(Calculator01Icon);
export const Check = createIcon(Tick02Icon);
export const Chemistry = createIcon(Chemistry01Icon);
export const ChevronDown = createIcon(ArrowDown01Icon);
export const CircleAlert = createIcon(AlertCircleIcon);
export const ClipboardList = createIcon(Task01Icon);
export const ClipboardEdit = createIcon(TaskEdit01Icon);
export const Clock3 = createIcon(Clock03Icon);
export const Code = createIcon(CodeIcon);
export const Computer = createIcon(ComputerIcon);
export const Dna = createIcon(Dna01Icon);
export const Dumbbell = createIcon(Dumbbell02Icon);
export const Earth = createIcon(EarthIcon);
export const Eye = createIcon(ViewIcon);
export const EyeOff = createIcon(ViewOffIcon);
export const Football = createIcon(FootballIcon);
export const GraduationCap = createIcon(Mortarboard01Icon);
export const GreekHelmet = createIcon(GreekHelmetIcon);
export const Globe = createIcon(GlobeIcon);
export const Home = createIcon(Home02Icon);
export const Language = createIcon(LanguageCircleIcon);
export const Logout = createIcon(Logout03Icon);
export const Maps = createIcon(MapsCircle01Icon);
export const Mail = createIcon(Mail01Icon);
export const Mic = createIcon(Mic01Icon);
export const Moon = createIcon(Moon02Icon);
export const MusicNote = createIcon(MusicNote01Icon);
export const Note = createIcon(NoteIcon);
export const NotebookPen = createIcon(NotebookIcon);
export const Palette = createIcon(PaintBoardIcon);
export const PaintBrush = createIcon(PaintBrush01Icon);
export const Pencil = createIcon(PencilIcon);
export const Plant = createIcon(Plant04Icon);
export const Plus = createIcon(PlusSignIcon);
export const PropertyEdit = createIcon(PropertyEditIcon);
export const Route2 = createIcon(Route02Icon);
export const Rocket = createIcon(Rocket01Icon);
export const ScanImage = createIcon(ScanImageIcon);
export const Settings = createIcon(Settings01Icon);
export const SquareLock = createIcon(SquareLock02Icon);
export const SquareRootSquare = createIcon(SquareRootSquareIcon);
export const Sun = createIcon(Sun01Icon);
export const Telescope = createIcon(Telescope01Icon);
export const Time04 = createIcon(Time04Icon);
export const TimeManagement = createIcon(TimeManagementCircleIcon);
export const Timer = createIcon(Clock03Icon);
export const Trash2 = createIcon(Delete02Icon);
export const UserRound = createIcon(UserCircleIcon);
export const X = createIcon(Cancel01Icon);
