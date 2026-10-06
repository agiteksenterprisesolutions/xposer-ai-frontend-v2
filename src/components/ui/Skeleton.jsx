// src/components/ui/Skeleton.jsx
//
// Placeholders shaped like the content they stand in for, so a page holds
// still when its data arrives. Each piece takes exactly the space the real
// element will: a text line is as tall as that text's line height (the grey
// bar sits inside it), a badge is a badge-sized pill, an avatar is the
// avatar's size. A page's skeleton should be built from its real containers —
// the same cards, grids and paddings — with these in place of the data.
//
//   <Skeleton className="h-10 w-full rounded-lg" />   any block
//   <Skeleton.Text size="sm" className="w-32" />       one line of text-sm
//   <Skeleton.Lines size="sm" lines={2} />             a paragraph
//   <Skeleton.Badge />  <Skeleton.Circle size="h-10 w-10" />  <Skeleton.Button />

const pulse = 'animate-pulse bg-active';

/** A block of any size. Give it dimensions and a radius via className. */
const Skeleton = ({ className = '', style }) => (
  <span aria-hidden="true" className={`block rounded ${pulse} ${className}`} style={style} />
);

// line height → bar height, per Tailwind text size (bars are ~60% of the line)
const TEXT = {
  '2xs': ['h-3.5', 'h-2'],
  xs: ['h-4', 'h-2.5'],
  sm: ['h-5', 'h-3'],
  base: ['h-6', 'h-3.5'],
  lg: ['h-7', 'h-4'],
  xl: ['h-7', 'h-5'],
  '2xl': ['h-8', 'h-6'],
  '3xl': ['h-9', 'h-7'],
};

/** One line of text at `size`; set its width with className (w-24, w-1/2…). */
const Text = ({ size = 'sm', className = 'w-24' }) => {
  const [line, bar] = TEXT[size] || TEXT.sm;
  return (
    <span aria-hidden="true" className={`flex items-center ${line} ${className}`}>
      <span className={`w-full rounded ${bar} ${pulse}`} />
    </span>
  );
};

/** A paragraph: full-width lines, the last one shorter. */
const Lines = ({ size = 'sm', lines = 3, lastWidth = 'w-2/3', className = '' }) => (
  <span aria-hidden="true" className={`block ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <Text key={index} size={size} className={index === lines - 1 && lines > 1 ? lastWidth : 'w-full'} />
    ))}
  </span>
);

/** A status/role badge (Badge size="small" is 20px tall). */
const Badge = ({ className = 'w-16', tall = false }) => (
  <span aria-hidden="true" className={`block rounded-full ${tall ? 'h-6' : 'h-5'} ${pulse} ${className}`} />
);

/** An avatar or round icon. */
const Circle = ({ size = 'h-10 w-10', className = '' }) => (
  <span aria-hidden="true" className={`block shrink-0 rounded-full ${pulse} ${size} ${className}`} />
);

/** A square icon tile (rounded-lg/xl boxes holding an icon). */
const Icon = ({ size = 'h-9 w-9', className = 'rounded-lg' }) => (
  <span aria-hidden="true" className={`block shrink-0 ${pulse} ${size} ${className}`} />
);

/** A button: default Button height is 40px, small is 32px. */
const Button = ({ className = 'w-28', small = false }) => (
  <span aria-hidden="true" className={`block rounded-lg ${small ? 'h-8' : 'h-10'} ${pulse} ${className}`} />
);

/** A donut chart, centred in a box of the chart's height. */
const Donut = ({ className = 'h-56 sm:h-64 lg:h-72' }) => (
  <span aria-hidden="true" className={`flex w-full items-center justify-center ${className}`}>
    <span className={`aspect-square h-[80%] rounded-full border-[2.25rem] border-active animate-pulse`} />
  </span>
);

/** Labelled progress bars (a name, a count, a bar beneath), as in category lists. */
const Bars = ({ rows = 3, className = 'space-y-1.5' }) =>
  Array.from({ length: rows }).map((_, index) => (
    <span key={index} aria-hidden="true" className={`block ${className}`}>
      <span className="flex justify-between gap-2">
        <Text className="w-36" />
        <Text className="w-14" />
      </span>
      <Skeleton className="h-2 w-full rounded-full" />
    </span>
  ));

Skeleton.Text = Text;
Skeleton.Donut = Donut;
Skeleton.Bars = Bars;
Skeleton.Lines = Lines;
Skeleton.Badge = Badge;
Skeleton.Circle = Circle;
Skeleton.Icon = Icon;
Skeleton.Button = Button;

export default Skeleton;
