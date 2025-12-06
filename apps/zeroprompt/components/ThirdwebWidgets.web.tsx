/**
 * ThirdwebWidgets - Disabled
 * Credit card payments temporarily unavailable
 */

interface ThirdwebWidgetsProps {
  visible: boolean;
  onClose: () => void;
  defaultAmount?: string;
  onSuccess?: (data: any) => void;
  receiverAddress?: string;
}

export default function ThirdwebWidgets(_props: ThirdwebWidgetsProps) {
  return null;
}
