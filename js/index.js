 function rndPosNeg() {
            return (Math.random() * 2) - 1;
        }

        //instantiate a TimelineLite    
        var tl = new TimelineLite();


        //TweenLite.to("polygon", 3, { x: 0, y: 0, scale: 0.0, rotation: 90, skewX: 0, ease: Expo.easeInOut, transformOrigin: "center center" });
        $("polygon").each(function (index, el) {
            //TweenLite.to(el, 1, { x: Math.random() * 100, delay: index * 0.05 })
            tl.to(el, 7, { x: (rndPosNeg() * (index * 0.5)), y: (rndPosNeg() * (index * 0.5)), rotation: (rndPosNeg() * 720), scale: (rndPosNeg() * 5), ease: Power4.easeInOut, transformOrigin: "center center" }, '-=7');
        });

        $("body").mousemove(function (e) {
            tl.time((e.pageX / 1600) * tl.duration());
            tl.pause();
        })