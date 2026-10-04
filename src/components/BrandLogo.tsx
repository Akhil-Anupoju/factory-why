import React, {useState} from 'react';

interface BrandLogoProps {
  src?: string;
  alt?: string;
  className?: string;
  size?: number | string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ src = '/assets/factorywhy-logo.png', alt = 'Factory WHY', className = '', size = 40 }) => {
  const [failed, setFailed] = useState(false);

  // Simple fallback: circular badge with FW initials when logo file missing
  const Fallback = () => (
    <div className={`flex items-center justify-center bg-slate-900 text-white font-bold rounded ${className}`} style={{ width: size, height: size }}>
      <span style={{ fontSize: typeof size === 'number' ? Math.round((size as number) * 0.4) : undefined }}>FW</span>
    </div>
  );

  if (!src) return <Fallback />;

  return (
    <>
      {!failed ? (
        // show image; if it fails to load show fallback
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      ) : (
        <Fallback />
      )}
    </>
  );
};

export default BrandLogo;
