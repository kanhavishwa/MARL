import { useRouter } from "@tanstack/react-router";

function DefaultErrorComponent({ error, reset }) {
  const router = useRouter();

  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>

      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
    </div>
  );
}

export default DefaultErrorComponent;