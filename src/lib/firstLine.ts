export default function firstLine(text: string | undefined): string | undefined {
  const newline = text?.indexOf('\n');
  if (newline === -1) return text;
  return text?.substring(0, newline);
}
