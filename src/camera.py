import cv2
import time
import app.services.image_compare as image_compare
import os
import util


def main():
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Could not read frame.")
            break

        now = util.get_current_time_string()

        cv2.imshow('Camera Feed', frame)
        cv2.imwrite(f'./images/image_{now}.jpg', frame)

        images = os.listdir('./images/')
        if len(images) > 1:
            try:
                candidate_image = images[-1]
                candidate_path = os.path.join('./images/', candidate_image)

                is_similar = False

                for image in images[:-1]:
                    reference_path = os.path.join('./images/', image)
                    result = image_compare.compare_images(
                        reference_path, candidate_path)
                    is_similar = is_similar or result.similar

                if is_similar:
                    print("Similar image detected. Removing new image.")
                    os.remove(candidate_path)
                else:
                    print(
                        f"ALERT: Not similar image. Saved new image: {candidate_path}")

            except Exception as e:
                print(f"Error during image comparison: {e}")

        deadline = time.time() + 5
        quit_pressed = False
        while time.time() < deadline:
            if cv2.waitKey(1) & 0xFF == ord('q'):
                quit_pressed = True
                break
        if quit_pressed:
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
