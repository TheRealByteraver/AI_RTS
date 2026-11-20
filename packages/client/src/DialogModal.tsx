import { FOOTER_STYLE, MODAL_STYLE, OVERLAY_STYLE } from './modalStyles';

export type DialogAction = {
  label: string;
  onClick: () => void;
};

type Props = {
  id: string;
  title: string;
  message: string;
  actions: DialogAction[];
};

// A simple message + buttons modal, e.g. for confirmations.
const DialogModal = (props: Props) => {
  // PROPS
  const { id, title, message, actions } = props;

  // VARS
  const titleId = `${id}-title`;

  return (
    <div style={OVERLAY_STYLE}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={MODAL_STYLE}
      >
        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>
        <div style={FOOTER_STYLE}>
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { DialogModal };
