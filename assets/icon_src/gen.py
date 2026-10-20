import math, sys

def squircle(cx, cy, size, n=3.0, pts=90):
    e = 0.30*size; h = size/2
    corners = [(cx+h-e, cy-h+e, 0), (cx+h-e, cy+h-e, 90), (cx-h+e, cy+h-e, 180), (cx-h+e, cy-h+e, 270)]
    out=[]
    for (ox, oy, start) in corners:
        for i in range(pts+1):
            t = math.radians(start - 90 + 90*i/pts)
            c, s_ = math.cos(t), math.sin(t)
            out.append(f"{ox+e*math.copysign(abs(c)**(2/n),c):.2f},{oy+e*math.copysign(abs(s_)**(2/n),s_):.2f}")
    return "M"+" L".join(out)+" Z"

def svg(mode="mac", P=""):
    T = 824 if mode=="mac" else 1024
    k = 1.0 if mode=="mac" else 1.08
    tile = squircle(512,512,T)
    S = lambda v: v*k
    cx, cy = 512, 512 + S(118)            # portal centre
    rx, ry, sw = S(272), S(88), S(40)
    ts = S(330); tx = 512 - ts/2; ty = cy + S(34) - ts    # app tile
    tr = ts*0.23
    # front rim of the hole: the lower half of the ellipse's inner edge
    irx, iry = rx - sw/2, ry - sw/2
    lower = " ".join(f"L{cx+irx*math.cos(math.radians(a)):.1f},{cy+iry*math.sin(math.radians(a)):.1f}" for a in range(0,181,4))
    clip = f"M0,0 L1024,0 L1024,{cy:.1f} L{cx+irx:.1f},{cy:.1f} {lower} L0,{cy:.1f} Z"
    ell = lambda a0, a1, step: " ".join(f"{'M' if i==0 else 'L'}{cx+rx*math.cos(math.radians(a)):.1f},{cy+ry*math.sin(math.radians(a)):.1f}" for i,a in enumerate(range(a0, a1+1, step)))
    bars = []
    bh = ts*0.10; bx = tx + ts*0.21
    for i,(w,y) in enumerate([(0.58,0.30),(0.42,0.46),(0.26,0.62)]):
        bars.append(f'<rect x="{bx:.1f}" y="{ty+ts*y:.1f}" width="{ts*w:.1f}" height="{bh:.1f}" rx="{bh/2:.1f}" fill="url(#{P}bar{i})"/>')
    g=[f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
 <linearGradient id="{P}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24212B"/><stop offset="1" stop-color="#0B0A0E"/></linearGradient>
 <radialGradient id="{P}bloom" cx="0.5" cy="0.56" r="0.5"><stop offset="0" stop-color="#FF4F7A" stop-opacity="0.24"/><stop offset="0.3" stop-color="#C255D9" stop-opacity="0.12"/><stop offset="0.6" stop-color="#9A5CFF" stop-opacity="0.05"/><stop offset="1" stop-color="#9A5CFF" stop-opacity="0"/></radialGradient>
 <linearGradient id="{P}rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#fff" stop-opacity="0.08"/></linearGradient>
 <linearGradient id="{P}ring" gradientUnits="userSpaceOnUse" x1="{cx-rx:.0f}" y1="0" x2="{cx+rx:.0f}" y2="0"><stop offset="0" stop-color="#3A7BFF"/><stop offset="0.35" stop-color="#9A5CFF"/><stop offset="0.68" stop-color="#FF4F7A"/><stop offset="1" stop-color="#FFAE2B"/></linearGradient>
 <linearGradient id="{P}ringback" gradientUnits="userSpaceOnUse" x1="{cx-rx:.0f}" y1="0" x2="{cx+rx:.0f}" y2="0"><stop offset="0" stop-color="#22408F"/><stop offset="0.35" stop-color="#5A3496"/><stop offset="0.68" stop-color="#93294C"/><stop offset="1" stop-color="#94621A"/></linearGradient>
 <radialGradient id="{P}hole" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFD1E0" stop-opacity="0.95"/><stop offset="0.35" stop-color="#FF4F7A" stop-opacity="0.85"/><stop offset="0.75" stop-color="#7A3FD9" stop-opacity="0.8"/><stop offset="1" stop-color="#1A0E2E"/></radialGradient>
 <linearGradient id="{P}beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF7AA0" stop-opacity="0.55"/><stop offset="0.5" stop-color="#9A5CFF" stop-opacity="0.18"/><stop offset="1" stop-color="#9A5CFF" stop-opacity="0"/></linearGradient>
 <linearGradient id="{P}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E2938"/><stop offset="1" stop-color="#100D15"/></linearGradient>
 <linearGradient id="{P}gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.20"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <linearGradient id="{P}bar0" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF4F7A"/><stop offset="1" stop-color="#FFAE2B"/></linearGradient>
 <linearGradient id="{P}bar1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9A5CFF"/><stop offset="1" stop-color="#FF4F7A"/></linearGradient>
 <linearGradient id="{P}bar2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A7BFF"/><stop offset="1" stop-color="#9A5CFF"/></linearGradient>
 <filter id="{P}tileshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.5"/></filter>
 <filter id="{P}appshadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="{S(16):.1f}" stdDeviation="{S(20):.1f}" flood-color="#000" flood-opacity="0.55"/></filter>
 <filter id="{P}glow" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="{S(18):.1f}"/></filter>
 <clipPath id="{P}tclip"><path d="{tile}"/></clipPath>
 <clipPath id="{P}rise"><path d="{clip}"/></clipPath>
</defs>''']
    if mode=="mac": g.append(f'<path d="{tile}" fill="#000" filter="url(#{P}tileshadow)"/>')
    g.append(f'<path d="{tile}" fill="url(#{P}bg)"/>')
    g.append(f'<g clip-path="url(#{P}tclip)"><rect width="1024" height="1024" fill="url(#{P}bloom)"/>')
    # light rising out of the portal
    g.append(f'<path d="M{cx-irx*0.92:.1f},{cy:.1f} L{cx-ts*0.62:.1f},{ty-S(40):.1f} L{cx+ts*0.62:.1f},{ty-S(40):.1f} L{cx+irx*0.92:.1f},{cy:.1f} Z" fill="url(#{P}beam)" filter="url(#{P}glow)"/>')
    # back half of the ring, then the glowing hole
    g.append(f'<path d="{ell(180,360,3)}" fill="none" stroke="url(#{P}ringback)" stroke-width="{sw:.1f}" stroke-linecap="round"/>')
    g.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{irx:.1f}" ry="{iry:.1f}" fill="url(#{P}hole)"/>')
    g.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{irx*1.05:.1f}" ry="{iry*1.6:.1f}" fill="#FF4F7A" fill-opacity=".35" filter="url(#{P}glow)"/>')
    # the app rising out of the portal
    g.append(f'<g clip-path="url(#{P}rise)">')
    g.append(f'<rect x="{tx:.1f}" y="{ty:.1f}" width="{ts:.1f}" height="{ts:.1f}" rx="{tr:.1f}" fill="url(#{P}glass)" filter="url(#{P}appshadow)"/>')
    g.append(f'<rect x="{tx:.1f}" y="{ty:.1f}" width="{ts:.1f}" height="{ts:.1f}" rx="{tr:.1f}" fill="url(#{P}gloss)"/>')
    g.append(f'<rect x="{tx+1.5*k:.1f}" y="{ty+1.5*k:.1f}" width="{ts-3*k:.1f}" height="{ts-3*k:.1f}" rx="{tr-1.5*k:.1f}" fill="none" stroke="#fff" stroke-opacity=".30" stroke-width="{3*k:.1f}"/>')
    g += bars
    # portal light washing up the tile's lower edge
    g.append(f'<rect x="{tx:.1f}" y="{ty:.1f}" width="{ts:.1f}" height="{ts:.1f}" rx="{tr:.1f}" fill="url(#{P}beam)" opacity=".7"/>')
    g.append('</g>')
    # front half of the ring, glossy
    g.append(f'<path d="{ell(0,180,3)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="{sw:.1f}" stroke-linecap="round" transform="translate(0 {S(10):.1f})" filter="url(#{P}glow)"/>')
    g.append(f'<path d="{ell(0,180,3)}" fill="none" stroke="url(#{P}ring)" stroke-width="{sw:.1f}" stroke-linecap="round"/>')
    g.append(f'<path d="{ell(10,170,3)}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="{S(5):.1f}" stroke-linecap="round" transform="translate(0 {-sw*0.28:.1f})"/>')
    g.append('</g>')
    g.append(f'<path d="{tile}" fill="none" stroke="url(#{P}rim)" stroke-width="{3*(T/824):.1f}" clip-path="url(#{P}tclip)"/>')
    g.append('</svg>')
    return "\n".join(g)

if __name__=="__main__":
    open(sys.argv[2],"w").write(svg(sys.argv[1]))
