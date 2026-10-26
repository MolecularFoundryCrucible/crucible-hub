import { useCallback, useEffect, useRef, useState } from "react"
import type QrScannerType from "qr-scanner"

import {
  BackToSearchIcon,
  RetryQrScanIcon,
  SwitchCameraIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractMfidFromQrCode } from "@/lib/crucible-qr-code"

type ScannerState = "starting" | "scanning" | "invalid" | "error" | "opening"

function supportsCameraAccess() {
  const mediaDevices = Reflect.get(navigator, "mediaDevices")
  return (
    typeof mediaDevices === "object" &&
    typeof Reflect.get(mediaDevices, "getUserMedia") === "function"
  )
}

function cameraErrorMessage(error?: unknown) {
  if (!window.isSecureContext) {
    return "Camera access requires HTTPS or localhost. You can enter the MFID instead."
  }
  if (!supportsCameraAccess()) {
    return "This browser does not support camera access. You can enter the MFID instead."
  }
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera permission was denied. Allow camera access and try again, or enter the MFID instead."
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. You can enter the MFID instead."
  }
  return "The camera could not be started. Try again or enter the MFID instead."
}

export function QrCodeScanner({
  onBack,
  onMfid,
}: {
  onBack: () => void
  onMfid: (mfid: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScannerType | null>(null)
  const sessionRef = useRef(0)
  const [attempt, setAttempt] = useState(0)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>(
    []
  )
  const [cameraIndex, setCameraIndex] = useState(0)
  const [state, setState] = useState<ScannerState>("starting")
  const [message, setMessage] = useState("Requesting camera access...")

  const handleDecodedValue = useCallback(
    (value: string) => {
      const mfid = extractMfidFromQrCode(value, window.location.hostname)
      if (!mfid) {
        setState("invalid")
        setMessage(
          "This QR code does not contain a valid MFID or recognized Crucible link."
        )
        return
      }

      scannerRef.current?.stop()
      setState("opening")
      setMessage("MFID scanned. Opening resource...")
      onMfid(mfid)
    },
    [onMfid]
  )

  useEffect(() => {
    const session = ++sessionRef.current
    const isCurrentSession = () => sessionRef.current === session
    const video = videoRef.current
    if (!video) return

    setState("starting")
    setMessage("Requesting camera access...")
    setCameras([])

    void import("qr-scanner")
      .then(async ({ default: QrScanner }) => {
        if (!isCurrentSession()) return
        if (!window.isSecureContext || !supportsCameraAccess()) {
          setState("error")
          setMessage(cameraErrorMessage())
          return
        }

        const scanner = new QrScanner(
          video,
          (result) => handleDecodedValue(result.data),
          {
            maxScansPerSecond: 10,
            preferredCamera: "environment",
            returnDetailedScanResult: true,
          }
        )
        scannerRef.current = scanner

        try {
          await scanner.start()
          if (!isCurrentSession()) {
            scanner.destroy()
            return
          }
          setState("scanning")
          setMessage("")
          try {
            const availableCameras = await QrScanner.listCameras(true)
            if (!isCurrentSession()) return
            const activeCameraId =
              video.srcObject instanceof MediaStream
                ? video.srcObject.getVideoTracks()[0]?.getSettings().deviceId
                : undefined
            const activeIndex = availableCameras.findIndex(
              (camera) => camera.id === activeCameraId
            )
            setCameras(availableCameras)
            setCameraIndex(activeIndex >= 0 ? activeIndex : 0)
          } catch {
            if (!isCurrentSession()) return
            setCameras([])
          }
        } catch (error) {
          if (!isCurrentSession()) return
          scanner.stop()
          setState("error")
          setMessage(cameraErrorMessage(error))
        }
      })
      .catch(() => {
        if (!isCurrentSession()) return
        setState("error")
        setMessage(
          "The QR scanner could not be loaded. Enter the MFID instead."
        )
      })

    return () => {
      sessionRef.current += 1
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [attempt, handleDecodedValue])

  async function switchCamera() {
    const scanner = scannerRef.current
    if (!scanner || cameras.length < 2) return
    const nextIndex = (cameraIndex + 1) % cameras.length
    try {
      await scanner.setCamera(cameras[nextIndex].id)
      setCameraIndex(nextIndex)
    } catch (error) {
      scanner.stop()
      setState("error")
      setMessage(cameraErrorMessage(error))
    }
  }

  function retry() {
    setAttempt((currentAttempt) => currentAttempt + 1)
  }

  return (
    <div className="grid gap-4">
      <div className="qr-viewfinder">
        <video
          aria-label="Camera preview"
          autoPlay
          muted
          playsInline
          ref={videoRef}
        />
        {state === "error" ? null : (
          <div aria-hidden="true" className="qr-viewfinder-frame">
            <svg fill="none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path
                d="M2 22V10a8 8 0 0 1 8-8h12M78 2h12a8 8 0 0 1 8 8v12M98 78v12a8 8 0 0 1-8 8H78M22 98H10a8 8 0 0 1-8-8V78"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className={cn(
          "text-body empty:sr-only",
          state === "error" && "text-destructive"
        )}
        role={state === "error" ? "alert" : "status"}
      >
        {message}
      </p>
      <div className="flex flex-col gap-2 @fields:flex-row @fields:flex-wrap">
        {state === "error" && (
          <Button onClick={retry} type="button">
            <RetryQrScanIcon aria-hidden="true" data-icon="inline-start" />
            Scan again
          </Button>
        )}
        {state === "scanning" && cameras.length > 1 && (
          <Button
            onClick={() => void switchCamera()}
            type="button"
            variant="outline"
          >
            <SwitchCameraIcon aria-hidden="true" data-icon="inline-start" />
            Switch camera
          </Button>
        )}
        <Button onClick={onBack} type="button" variant="outline">
          <BackToSearchIcon aria-hidden="true" data-icon="inline-start" />
          Enter MFID instead
        </Button>
      </div>
    </div>
  )
}
