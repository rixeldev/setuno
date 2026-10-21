package com.rixeldev.setuno.ocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

/**
 * On-device text recognition (roadmap #84).
 *
 * Android reads the text with **ML Kit** — the *bundled* Latin model, so
 * nothing is downloaded and nothing leaves the phone. A PDF is rasterized by
 * the platform itself (`PdfRenderer`) and read page by page.
 *
 * The app never sends the photo anywhere: this module is the whole privacy
 * story of the feature.
 */
class SetunoOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SetunoOcr")

    AsyncFunction("recognizeImage") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_OCR_NO_CONTEXT", "The app is not running.", null)
        return@AsyncFunction
      }
      executor.execute {
        try {
          val bitmap = decodeBitmap(context, Uri.parse(uri))
          if (bitmap == null) {
            promise.reject("E_OCR_IMAGE", "The photo could not be read.", null)
            return@execute
          }
          readBitmap(context, bitmap) { page, error ->
            if (error != null) {
              promise.reject("E_OCR", error.message, error)
            } else {
              promise.resolve(mapOf("pages" to listOf(page)))
            }
          }
        } catch (error: Exception) {
          promise.reject("E_OCR", error.message, error)
        }
      }
    }

    AsyncFunction("recognizePdf") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_OCR_NO_CONTEXT", "The app is not running.", null)
        return@AsyncFunction
      }
      executor.execute {
        try {
          val renderer = openPdf(context, Uri.parse(uri))
          if (renderer == null) {
            promise.reject("E_OCR_PDF", "The PDF could not be opened.", null)
            return@execute
          }
          val bitmaps = renderPages(renderer)
          renderer.close()
          if (bitmaps.isEmpty()) {
            promise.reject("E_OCR_PDF", "The PDF has no pages.", null)
            return@execute
          }
          readAll(context, bitmaps) { pages, error ->
            if (error != null) {
              promise.reject("E_OCR", error.message, error)
            } else {
              promise.resolve(mapOf("pages" to pages))
            }
          }
        } catch (error: Exception) {
          promise.reject("E_OCR", error.message, error)
        }
      }
    }
  }

  private companion object {
    /** The CPU work (decoding, rasterizing) never runs on the JS thread. */
    val executor = Executors.newSingleThreadExecutor()

    /** The long edge a page is scaled down to before it is read. */
    const val MAX_EDGE = 2400

    /** How much bigger a PDF page is rendered than its own size. */
    const val PDF_SCALE = 2f
  }

  /**
   * Reads one bitmap, line by line, with the geometry of every word.
   *
   * The recognizer answers on its own thread, so the result is handed back
   * through the callback instead of being returned.
   */
  private fun readBitmap(
    context: Context,
    bitmap: Bitmap,
    onResult: (Map<String, Any?>?, Exception?) -> Unit,
  ) {
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    recognizer
      .process(InputImage.fromBitmap(bitmap, 0))
      .addOnSuccessListener { text -> onResult(mapPage(bitmap, text), null) }
      .addOnFailureListener { error -> onResult(null, error) }
      .addOnCompleteListener { recognizer.close() }
  }

  /** Reads a list of bitmaps in order, one after the other. */
  private fun readAll(
    context: Context,
    bitmaps: List<Bitmap>,
    onResult: (List<Map<String, Any?>>, Exception?) -> Unit,
  ) {
    val pages = mutableListOf<Map<String, Any?>>()
    var index = 0

    fun next() {
      if (index >= bitmaps.size) {
        onResult(pages, null)
        return
      }
      val bitmap = bitmaps[index]
      index += 1
      readBitmap(context, bitmap) { page, error ->
        if (error != null || page == null) {
          onResult(pages, error ?: Exception("The page could not be read."))
          return@readBitmap
        }
        pages.add(page)
        next()
      }
    }

    next()
  }

  /** One page: its size and every line the recognizer found. */
  private fun mapPage(bitmap: Bitmap, text: Text): Map<String, Any?> {
    val lines = mutableListOf<Map<String, Any?>>()
    for (block in text.textBlocks) {
      for (line in block.lines) {
        val words = line.elements.map { element ->
          mapOf("text" to element.text, "box" to mapBox(element.boundingBox))
        }
        lines.add(
          mapOf(
            "text" to line.text,
            "box" to mapBox(line.boundingBox),
            "words" to words,
          ),
        )
      }
    }
    return mapOf(
      "width" to bitmap.width,
      "height" to bitmap.height,
      "lines" to lines,
    )
  }

  /** A rectangle in the page's own pixels, with the origin at the top left. */
  private fun mapBox(rect: Rect?): Map<String, Double> {
    val left = rect?.left ?: 0
    val top = rect?.top ?: 0
    val right = rect?.right ?: 0
    val bottom = rect?.bottom ?: 0
    return mapOf(
      "x" to left.toDouble(),
      "y" to top.toDouble(),
      "width" to (right - left).coerceAtLeast(0).toDouble(),
      "height" to (bottom - top).coerceAtLeast(0).toDouble(),
    )
  }

  /** Decodes a photo, scaled down when it is huge. */
  private fun decodeBitmap(context: Context, uri: Uri): Bitmap? {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    val options = BitmapFactory.Options().apply {
      inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight)
    }
    return resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
  }

  /** The power of two that brings the long edge under the cap. */
  private fun sampleSize(width: Int, height: Int): Int {
    if (width <= 0 || height <= 0) return 1
    var sample = 1
    var longest = maxOf(width, height)
    while (longest / 2 >= MAX_EDGE) {
      longest /= 2
      sample *= 2
    }
    return sample
  }

  /** Opens a PDF (a real file or a content:// one). */
  private fun openPdf(context: Context, uri: Uri): PdfRenderer? = try {
    val descriptor = context.contentResolver.openFileDescriptor(uri, "r")
    if (descriptor == null) null else PdfRenderer(descriptor)
  } catch (error: Exception) {
    null
  }

  /** Rasterizes every page of the PDF. */
  private fun renderPages(renderer: PdfRenderer): List<Bitmap> {
    val bitmaps = mutableListOf<Bitmap>()
    for (index in 0 until renderer.pageCount) {
      val page = renderer.openPage(index)
      val width = (page.width * PDF_SCALE).toInt().coerceAtLeast(1)
      val height = (page.height * PDF_SCALE).toInt().coerceAtLeast(1)
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      bitmap.eraseColor(Color.WHITE)
      page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      page.close()
      bitmaps.add(bitmap)
    }
    return bitmaps
  }
}
