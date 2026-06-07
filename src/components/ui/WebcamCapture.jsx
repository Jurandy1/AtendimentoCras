import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, X } from 'lucide-react';
import Button from '../ui/Button';

const videoConstraints = {
  width: 480,
  height: 480,
  facingMode: "user"
};

const WebcamCapture = ({ onCapture, onCancel, initialImage = null }) => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(initialImage);
  const [isCameraOpen, setIsCameraOpen] = useState(!initialImage);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImgSrc(imageSrc);
    setIsCameraOpen(false);
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
    setIsCameraOpen(true);
  };

  const confirm = () => {
    if (imgSrc) {
      onCapture(imgSrc);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50">
      <div className="relative w-64 h-64 bg-gray-200 rounded-full overflow-hidden border-4 border-white shadow-lg">
        {isCameraOpen ? (
          <Webcam
            audio={false}
            height={480}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={480}
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />
        ) : imgSrc ? (
          <img src={imgSrc} alt="Captura" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-400">
            <Camera size={48} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {isCameraOpen ? (
          <Button onClick={capture} variant="primary" icon={Camera}>
            Tirar Foto
          </Button>
        ) : (
          <>
            <Button onClick={retake} variant="secondary" icon={RefreshCw}>
              Tirar Outra
            </Button>
            <Button onClick={confirm} variant="success" icon={Check}>
              Confirmar
            </Button>
          </>
        )}
        {onCancel && (
          <Button onClick={onCancel} variant="ghost" icon={X} className="text-red-500">
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;
