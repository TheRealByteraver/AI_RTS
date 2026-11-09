import type { IncomingInvitation } from './invitations';
import { FOOTER_STYLE, MODAL_STYLE, OVERLAY_STYLE } from './modalStyles';

type Props = {
  invitation: IncomingInvitation;
  currentUsername: string;
  onRespond: (accepted: boolean) => void;
};

const InvitationReceivedModal = (props: Props) => {
  // PROPS
  const { invitation, currentUsername, onRespond } = props;

  // VARS
  const otherInvitees = invitation.invitees.filter(
    (name) => name !== currentUsername,
  );

  return (
    <div style={OVERLAY_STYLE}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-received-title"
        style={MODAL_STYLE}
      >
        <h2 id="invitation-received-title">Game invitation</h2>
        <p>
          <strong>{invitation.inviter}</strong> invited you to play a game.
        </p>
        {otherInvitees.length > 0 && (
          <p>Also invited: {otherInvitees.join(', ')}</p>
        )}
        <p>Do you want to join?</p>
        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => onRespond(true)}>
            Yes
          </button>
          <button type="button" onClick={() => onRespond(false)}>
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export { InvitationReceivedModal };
