// Run: swift assert-footer.swift path/to/native-screenshot.png
// Vision reads the rendered text, not Pressable bounds (which also contain padding).
import Foundation
import Vision
import ImageIO
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["de-DE"]
try VNImageRequestHandler(url: url).perform([request])
let observations = request.results ?? []
func find(_ text: String) -> VNRecognizedTextObservation? {
    observations.first { $0.topCandidates(1).first?.string.contains(text) == true }
}
guard let support = find("Support"), let privacy = find("Datenschutz") else {
    fputs("FAIL: footer text is not fully visible\n", stderr)
    exit(1)
}
let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)! as NSDictionary
let height = props[kCGImagePropertyPixelHeight] as! Double
let difference = abs(support.boundingBox.midY - privacy.boundingBox.midY) * height
print(String(format: "Support/privacy text-center difference: %.2f px", difference))
if difference > 6 {
    fputs("FAIL: first-row links are vertically misaligned\n", stderr)
    exit(1)
}
print("PASS: first-row footer text is aligned")
