import ExpoModulesCore
import Foundation
import PDFKit
import UIKit
import Vision

/**
 On-device text recognition (roadmap #84).

 iOS reads the text with the system's **Vision** framework — no model to
 download and nothing leaves the phone. A PDF is rasterized with **PDFKit**
 and read page by page.
 */
public class SetunoOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SetunoOcr")

    AsyncFunction("recognizeImage") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let image = SetunoOcrModule.loadImage(uri: uri),
              let cgImage = image.cgImage else {
          promise.reject("E_OCR_IMAGE", "The photo could not be read.")
          return
        }
        do {
          let page = try SetunoOcrModule.readPage(
            image: cgImage,
            width: cgImage.width,
            height: cgImage.height
          )
          promise.resolve(["pages": [page]])
        } catch {
          promise.reject("E_OCR", error.localizedDescription)
        }
      }
    }

    AsyncFunction("recognizePdf") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let pages = try SetunoOcrModule.readPdf(uri: uri)
          promise.resolve(["pages": pages])
        } catch {
          promise.reject("E_OCR", error.localizedDescription)
        }
      }
    }
  }

  /// Reads one image, line by line, with the geometry of every word.
  private static func readPage(image: CGImage, width: Int, height: Int) throws -> [String: Any] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US", "es-ES", "pt-BR", "fr-FR"]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).sorted { $0.boundingBox.minY > $1.boundingBox.minY }
    var lines: [[String: Any]] = []
    for observation in observations {
      guard let candidate = observation.topCandidates(1).first else { continue }
      lines.append([
        "text": candidate.string,
        "confidence": Double(candidate.confidence),
        "box": pixelBox(observation.boundingBox, width: width, height: height),
        "words": words(of: candidate, width: width, height: height),
      ])
    }

    return ["width": width, "height": height, "lines": lines]
  }

  /// The words of a line, each with its own box.
  private static func words(of candidate: VNRecognizedText, width: Int, height: Int) -> [[String: Any]] {
    let text = candidate.string
    var found: [[String: Any]] = []
    var start = text.startIndex
    while start < text.endIndex {
      let rest = text[start...]
      let end = rest.firstIndex(where: { $0 == " " || $0 == "\n" || $0 == "\t" }) ?? text.endIndex
      let range = start..<end
      if let box = try? candidate.boundingBox(for: range) {
        found.append([
          "text": String(text[range]),
          "box": pixelBox(box, width: width, height: height),
        ])
      }
      start = end < text.endIndex ? text.index(after: end) : text.endIndex
    }
    return found
  }

  /// Vision's normalized box (origin at the bottom left) in the page's pixels.
  private static func pixelBox(_ box: CGRect, width: Int, height: Int) -> [String: Any] {
    let scaleX = Double(width)
    let scaleY = Double(height)
    return [
      "x": box.origin.x * scaleX,
      "y": (1 - box.origin.y - box.height) * scaleY,
      "width": box.width * scaleX,
      "height": box.height * scaleY,
    ]
  }

  /// Rasterizes a PDF and reads every page.
  private static func readPdf(uri: String) throws -> [[String: Any]] {
    let path = uri.hasPrefix("file://") ? String(uri.dropFirst("file://".count)) : uri
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
      throw SetunoOcrError.cannotOpen
    }

    var pages: [[String: Any]] = []
    for index in 0..<document.pageCount {
      guard let page = document.page(at: index) else { continue }
      let bounds = page.bounds(for: .mediaBox)
      let scale: CGFloat = 2
      let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
      let renderer = UIGraphicsImageRenderer(size: size)
      let image = renderer.image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        context.cgContext.translateBy(x: 0, y: size.height)
        context.cgContext.scaleBy(x: scale, y: -scale)
        page.draw(with: .mediaBox, to: context.cgContext)
      }
      guard let cgImage = image.cgImage else { continue }
      pages.append(try readPage(image: cgImage, width: cgImage.width, height: cgImage.height))
    }
    return pages
  }

  /// Loads a photo from a `file://` or a plain path.
  private static func loadImage(uri: String) -> UIImage? {
    let path = uri.hasPrefix("file://") ? String(uri.dropFirst("file://".count)) : uri
    if let data = try? Data(contentsOf: URL(fileURLWithPath: path)), let image = UIImage(data: data) {
      return image
    }
    return UIImage(contentsOfFile: path)
  }
}

/// The failures the module reports.
enum SetunoOcrError: Error, LocalizedError {
  case cannotOpen

  var errorDescription: String? {
    switch self {
    case .cannotOpen:
      return "The file could not be opened."
    }
  }
}
