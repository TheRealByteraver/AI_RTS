type Props = {
  onRetry: () => void;
  onGoToLogin: () => void;
};

function AlreadyConnectedScreen(props: Props) {
  // PROPS
  const { onRetry, onGoToLogin } = props;

  return (
    <div>
      <h1>Already connected</h1>
      <p>
        This account is already connected from another browser or tab.
        Only one active session is allowed at a time.
      </p>
      <p>Close the other session and retry, or go back to the login page.</p>
      <button onClick={onRetry}>Retry</button>
      {' '}
      <button onClick={onGoToLogin}>Back to login</button>
    </div>
  );
}

export { AlreadyConnectedScreen };
