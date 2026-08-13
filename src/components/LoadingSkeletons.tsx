/**
 * Loading skeleton screens dan animasi loading untuk UX yang lebih baik
 */

export function LoadingBar() {
  return (
    <div
      style={{
        height: 7,
        background: '#e8edf8',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          height: '100%',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 0.8s infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

export function LoadingSkeleton() {
  const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b' }

  return (
    <div style={{ background: S.bg, minHeight: '100vh', padding: '20px' }}>
      {/* Header Loading */}
      <div style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: '18px 32px', marginBottom: 20, borderRadius: 8 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Label skeleton */}
          <div
            style={{
              height: 12,
              background: S.border,
              borderRadius: 4,
              marginBottom: 12,
              width: 120,
              animation: 'pulse 1s infinite',
            }}
          />
          {/* Number skeleton */}
          <div
            style={{
              height: 40,
              background: S.border,
              borderRadius: 4,
              marginBottom: 16,
              width: 200,
              animation: 'pulse 1s infinite',
            }}
          />
          {/* Progress bar */}
          <LoadingBar />
        </div>
      </div>

      {/* Menu cards loading */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: S.card,
                borderRadius: 12,
                padding: 24,
                border: `1px solid ${S.border}`,
              }}
            >
              {/* Icon skeleton */}
              <div
                style={{
                  width: 50,
                  height: 50,
                  background: S.border,
                  borderRadius: 8,
                  marginBottom: 16,
                  animation: 'pulse 1s infinite',
                  animationDelay: `${i * 0.05}s`,
                }}
              />
              {/* Title skeleton */}
              <div
                style={{
                  height: 20,
                  background: S.border,
                  borderRadius: 4,
                  marginBottom: 12,
                  width: '80%',
                  animation: 'pulse 1s infinite',
                  animationDelay: `${i * 0.05 + 0.05}s`,
                }}
              />
              {/* Subtitle skeleton */}
              <div
                style={{
                  height: 14,
                  background: S.border,
                  borderRadius: 4,
                  marginBottom: 16,
                  width: '60%',
                  animation: 'pulse 1s infinite',
                  animationDelay: `${i * 0.05 + 0.1}s`,
                }}
              />
              {/* Description lines skeleton */}
              {Array.from({ length: 2 }).map((_, j) => (
                <div
                  key={j}
                  style={{
                    height: 12,
                    background: S.border,
                    borderRadius: 4,
                    marginBottom: 8,
                    width: j === 1 ? '70%' : '100%',
                    animation: 'pulse 1s infinite',
                    animationDelay: `${i * 0.05 + 0.15 + j * 0.02}s`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export function DataLoadingOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(240, 244, 255, 0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            borderRadius: '50%',
            opacity: 0.1,
            animation: 'spin 1.2s linear infinite',
          }}
        />
        <div
          style={{
            width: 50,
            height: 50,
            margin: '0 auto 20px',
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTop: '3px solid #3b82f6',
            borderRight: '3px solid #8b5cf6',
            animation: 'spin 0.6s linear infinite',
          }}
        />
        <div style={{ color: '#64748b', fontSize: 16, fontWeight: 600, marginTop: 16 }}>
          Loading…
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export function MenuCardSkeleton({ count = 1 }: { count?: number }) {
  const S = { card: '#fff', border: '#e8edf8' }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: S.card,
            borderRadius: 12,
            padding: 24,
            border: `1px solid ${S.border}`,
            minHeight: 240,
          }}
        >
          {/* Icon skeleton */}
          <div
            style={{
              width: 50,
              height: 50,
              background: S.border,
              borderRadius: 8,
              marginBottom: 16,
              animation: 'pulse 2s infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
          {/* Title skeleton */}
          <div
            style={{
              height: 20,
              background: S.border,
              borderRadius: 4,
              marginBottom: 12,
              width: '80%',
              animation: 'pulse 2s infinite',
              animationDelay: `${i * 0.1 + 0.1}s`,
            }}
          />
          {/* Subtitle skeleton */}
          <div
            style={{
              height: 14,
              background: S.border,
              borderRadius: 4,
              marginBottom: 16,
              width: '60%',
              animation: 'pulse 2s infinite',
              animationDelay: `${i * 0.1 + 0.15}s`,
            }}
          />
          {/* Description lines skeleton */}
          {Array.from({ length: 3 }).map((_, j) => (
            <div
              key={j}
              style={{
                height: 12,
                background: S.border,
                borderRadius: 4,
                marginBottom: 8,
                width: j === 2 ? '70%' : '100%',
                animation: 'pulse 2s infinite',
                animationDelay: `${i * 0.1 + 0.2 + j * 0.05}s`,
              }}
            />
          ))}
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
