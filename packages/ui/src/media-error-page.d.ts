export interface MediaErrorPageProps {
  status: number;
  code: string;
  title: string;
  description: string;
  requestId: string | null;
}

export function renderMediaErrorPage(props: MediaErrorPageProps): string;
