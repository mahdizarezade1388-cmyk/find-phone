const myIdElement = document.getElementById("myId");
const statusElement = document.getElementById("status");
const targetIdInput = document.getElementById("targetId");
const connectButton = document.getElementById("connectBtn");
const connectionBox = document.getElementById("connectionBox");
const connectionStatus = document.getElementById("connectionStatus");

let socket;
let peerConnection;
let dataChannel;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};

function setStatus(message) {
  statusElement.textContent = message;
}

function showConnectionStatus(message) {
  connectionBox.classList.remove("hidden");
  connectionStatus.textContent = message;
}

function connectToServer() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.onopen = () => {
    setStatus("به سرور متصل شدی ✅");
  };

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "connected") {
      myIdElement.textContent = message.id;
      return;
    }

    if (message.type === "error") {
      showConnectionStatus(`خطا: ${message.message}`);
      return;
    }

    if (message.type === "signal") {
      await handleSignal(message);
    }
  };

  socket.onclose = () => {
    setStatus("ارتباط با سرور قطع شد.");
  };

  socket.onerror = () => {
    setStatus("اتصال به سرور با مشکل مواجه شد.");
  };
}

function createPeerConnection(targetId) {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(targetId, {
        type: "ice-candidate",
        candidate: event.candidate
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;

    if (state === "connected") {
      showConnectionStatus("دو دستگاه با موفقیت متصل شدند ✅");
    }

    if (state === "disconnected") {
      showConnectionStatus("ارتباط قطع شد.");
    }

    if (state === "failed") {
      showConnectionStatus("اتصال برقرار نشد.");
    }
  };

  return peerConnection;
}

function sendSignal(targetId, data) {
  socket.send(
    JSON.stringify({
      type: "signal",
      target: targetId,
      data
    })
  );
}

connectButton.addEventListener("click", async () => {
  const targetId = targetIdInput.value.trim().toUpperCase();

  if (!targetId) {
    showConnectionStatus("اول کد دستگاه مقصد را وارد کن.");
    return;
  }

  if (targetId === myIdElement.textContent) {
    showConnectionStatus("نمی‌توانی به دستگاه خودت متصل شوی.");
    return;
  }

  createPeerConnection(targetId);

  dataChannel = peerConnection.createDataChannel("connection");

  dataChannel.onopen = () => {
    showConnectionStatus("اتصال مستقیم برقرار شد ✅");
  };

  dataChannel.onclose = () => {
    showConnectionStatus("ارتباط مستقیم قطع شد.");
  };

  try {
    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    sendSignal(targetId, {
      type: "offer",
      offer
    });

    showConnectionStatus("در حال برقراری اتصال...");
  } catch (error) {
    console.error(error);
    showConnectionStatus("ساخت اتصال با مشکل مواجه شد.");
  }
});

async function handleSignal(message) {
  const signal = message.data;
  const senderId = message.from;

  if (signal.type === "offer") {
    createPeerConnection(senderId);

    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;

      dataChannel.onopen = () => {
        showConnectionStatus("اتصال مستقیم برقرار شد ✅");
      };

      dataChannel.onclose = () => {
        showConnectionStatus("ارتباط مستقیم قطع شد.");
      };
    };

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal.offer)
      );

      const answer = await peerConnection.createAnswer();

      await peerConnection.setLocalDescription(answer);

      sendSignal(senderId, {
        type: "answer",
        answer
      });

      showConnectionStatus("در حال پاسخ به دستگاه مقابل...");
    } catch (error) {
      console.error(error);
      showConnectionStatus("پاسخ به اتصال با مشکل مواجه شد.");
    }
  }

  if (signal.type === "answer") {
    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal.answer)
      );
    } catch (error) {
      console.error(error);
      showConnectionStatus("برقراری اتصال با مشکل مواجه شد.");
    }
  }

  if (signal.type === "ice-candidate") {
    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(signal.candidate)
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
}

connectToServer();
