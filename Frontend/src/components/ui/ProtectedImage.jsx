const ProtectedImage = ({ src, alt, className = '' }) => (
  <div
    className={`relative overflow-hidden ${className}`}
    onContextMenu={(e) => e.preventDefault()}
    onDragStart={(e) => e.preventDefault()}
  >
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="w-full h-full object-cover pointer-events-none select-none"
    />
    <div className="absolute inset-0" />
  </div>
)

export default ProtectedImage
