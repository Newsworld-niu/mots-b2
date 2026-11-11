import Foundation
import PDFKit
import AppKit

// usage: swift render-pdf-pages.swift <pdf> <page1> <page2> ... <outdir>
let args = CommandLine.arguments
guard args.count >= 4 else {
    FileHandle.standardError.write("usage: render-pdf-pages.swift <pdf> <page> [page...] <outdir>\n".data(using: .utf8)!)
    exit(2)
}
let pdfPath = args[1]
let outDir = args[args.count - 1]
let pages = args[2..<(args.count - 1)].compactMap { Int($0) }

guard let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    FileHandle.standardError.write("cannot open pdf\n".data(using: .utf8)!)
    exit(1)
}
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let scale: CGFloat = 3.0
for p in pages {
    let idx = p - 1
    guard let page = doc.page(at: idx) else {
        print("page \(p): not found")
        continue
    }
    let bounds = page.bounds(for: .mediaBox)
    let w = Int(bounds.width * scale)
    let h = Int(bounds.height * scale)
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else {
        print("page \(p): cannot create bitmap")
        continue
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)).fill()
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    NSGraphicsContext.restoreGraphicsState()
    guard let png = rep.representation(using: .png, properties: [:]) else {
        print("page \(p): png failed")
        continue
    }
    let out = "\(outDir)/page-\(p).png"
    do {
        try png.write(to: URL(fileURLWithPath: out))
        print("wrote \(out) (\(w)x\(h))")
    } catch {
        print("page \(p): write failed \(error)")
    }
}
