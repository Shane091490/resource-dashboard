export default function Toast({ message }) {
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
